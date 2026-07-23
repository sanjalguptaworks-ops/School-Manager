import { Router } from "express";
import {
  db,
  pollsTable,
  pollOptionsTable,
  pollVotesTable,
  studentsTable,
  parentStudentsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";
import { notifyNewPoll } from "../lib/notify";

const router = Router();

async function attachResultsAndVoteState(pollIds: number[], authUserId: number) {
  if (pollIds.length === 0) return new Map<number, { options: any[]; totalVotes: number; hasVoted: boolean; myOptionId: number | null }>();

  // The subquery's own FROM (poll_votes) has its own `id` column, so a bare
  // interpolated reference to the outer poll_options.id would silently
  // resolve against poll_votes.id instead of correlating to the outer row --
  // spelling out the outer table's real name avoids that ambiguity.
  const options = await db
    .select({
      id: pollOptionsTable.id,
      pollId: pollOptionsTable.pollId,
      text: pollOptionsTable.text,
      voteCount: sql<number>`(select count(*)::int from poll_votes pv where pv.option_id = poll_options.id)`,
    })
    .from(pollOptionsTable)
    .where(sql`${pollOptionsTable.pollId} in ${pollIds}`);

  const myVotes = await db
    .select({ pollId: pollVotesTable.pollId, optionId: pollVotesTable.optionId })
    .from(pollVotesTable)
    .where(and(sql`${pollVotesTable.pollId} in ${pollIds}`, eq(pollVotesTable.userId, authUserId)));
  const myVoteByPoll = new Map(myVotes.map((v) => [v.pollId, v.optionId]));

  const byPoll = new Map<number, { options: any[]; totalVotes: number; hasVoted: boolean; myOptionId: number | null }>();
  for (const pollId of pollIds) {
    const opts = options.filter((o) => o.pollId === pollId);
    const totalVotes = opts.reduce((sum, o) => sum + o.voteCount, 0);
    byPoll.set(pollId, {
      options: opts.map((o) => ({ id: o.id, text: o.text, voteCount: o.voteCount })),
      totalVotes,
      hasVoted: myVoteByPoll.has(pollId),
      myOptionId: myVoteByPoll.get(pollId) ?? null,
    });
  }
  return byPoll;
}

// GET /polls — same class-scoping convention as /galleries and /homework.
router.get("/polls", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId, studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;

    const filters: any[] = [eq(pollsTable.schoolId, schoolId)];

    if (role === "student") {
      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
      if (!s) { res.json([]); return; }
      filters.push(sql`(${pollsTable.classId} = ${s.classId} or ${pollsTable.classId} is null)`);
    } else if (role === "parent") {
      const children = await db
        .select({ studentId: parentStudentsTable.studentId, classId: studentsTable.classId })
        .from(parentStudentsTable)
        .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
        .where(eq(parentStudentsTable.parentId, authUserId));
      if (children.length === 0) { res.json([]); return; }

      if (studentId) {
        const match = children.find((c) => c.studentId === parseInt(studentId));
        if (!match) { res.status(403).json({ error: "Forbidden" }); return; }
        filters.push(sql`(${pollsTable.classId} = ${match.classId} or ${pollsTable.classId} is null)`);
      } else {
        const classIds = children.map((c) => c.classId);
        filters.push(sql`(${pollsTable.classId} in ${classIds} or ${pollsTable.classId} is null)`);
      }
    } else if (role === "teacher") {
      const classScope = await getTeacherClassScope(authUserId);
      if (classId && !canAccessClass(classScope, parseInt(classId))) { res.status(403).json({ error: "Forbidden" }); return; }
      if (classId) filters.push(sql`(${pollsTable.classId} = ${parseInt(classId)} or ${pollsTable.classId} is null)`);
      else if (classScope.kind === "restricted") {
        if (classScope.classIds.length === 0) filters.push(sql`${pollsTable.classId} is null`);
        else filters.push(sql`(${pollsTable.classId} in ${classScope.classIds} or ${pollsTable.classId} is null)`);
      }
    } else {
      // admin
      if (classId) filters.push(sql`(${pollsTable.classId} = ${parseInt(classId)} or ${pollsTable.classId} is null)`);
    }

    const rows = await db
      .select()
      .from(pollsTable)
      .where(and(...filters))
      .orderBy(desc(pollsTable.createdAt));

    const results = await attachResultsAndVoteState(rows.map((r) => r.id), authUserId);
    // Students/parents don't see counts until they've voted -- avoids biasing
    // votes toward whatever option is already leading. Admin/teacher always
    // see full results, same as they can for any other feature in this app.
    const hideUntilVoted = role === "student" || role === "parent";
    res.json(
      rows.map((r) => {
        const result = results.get(r.id)!;
        if (hideUntilVoted && !result.hasVoted) {
          return { ...r, ...result, options: result.options.map((o: any) => ({ ...o, voteCount: 0 })), totalVotes: 0 };
        }
        return { ...r, ...result };
      }),
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /polls — admin or teacher
router.post("/polls", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { question, classId, closesAt, options } = req.body;
      if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
        res.status(400).json({ error: "question and at least 2 options are required" });
        return;
      }

      if (classId) {
        const classScope = await getTeacherClassScope(authUserId);
        if (!canAccessClass(classScope, classId)) { res.status(403).json({ error: "Forbidden" }); return; }
      }

      const [poll] = await db
        .insert(pollsTable)
        .values({ question, classId: classId || null, closesAt: closesAt || null, schoolId, createdBy: authUserId || null })
        .returning();

      await db.insert(pollOptionsTable).values(options.map((text: string) => ({ pollId: poll.id, text })));

      notifyNewPoll({ question: poll.question, classId: poll.classId }, schoolId);

      const results = await attachResultsAndVoteState([poll.id], authUserId);
      res.status(201).json({ ...poll, ...results.get(poll.id) });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /polls/:id/vote — one vote per user, enforced by the DB unique
// constraint on (pollId, userId); a second attempt is treated as a conflict
// rather than silently changing the vote.
router.post("/polls/:id/vote", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const id = parseInt(req.params["id"] as string);
    const { optionId } = req.body;
    if (!optionId) { res.status(400).json({ error: "optionId required" }); return; }

    const [poll] = await db
      .select({ id: pollsTable.id, closesAt: pollsTable.closesAt })
      .from(pollsTable)
      .where(and(eq(pollsTable.id, id), eq(pollsTable.schoolId, schoolId)))
      .limit(1);
    if (!poll) { res.status(404).json({ error: "Not found" }); return; }
    if (poll.closesAt && new Date(poll.closesAt) < new Date()) { res.status(400).json({ error: "This poll is closed" }); return; }

    const [option] = await db
      .select({ id: pollOptionsTable.id })
      .from(pollOptionsTable)
      .where(and(eq(pollOptionsTable.id, optionId), eq(pollOptionsTable.pollId, id)))
      .limit(1);
    if (!option) { res.status(400).json({ error: "Invalid optionId" }); return; }

    const [inserted] = await db
      .insert(pollVotesTable)
      .values({ pollId: id, optionId, userId: authUserId })
      .onConflictDoNothing()
      .returning();
    if (!inserted) { res.status(409).json({ error: "You've already voted on this poll" }); return; }

    const [updated] = await db.select().from(pollsTable).where(eq(pollsTable.id, id)).limit(1);
    const results = await attachResultsAndVoteState([id], authUserId);
    res.json({ ...updated, ...results.get(id) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /polls/:id — admin or teacher
router.delete("/polls/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [deleted] = await db
        .delete(pollsTable)
        .where(and(eq(pollsTable.id, id), eq(pollsTable.schoolId, schoolId)))
        .returning();
      if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
