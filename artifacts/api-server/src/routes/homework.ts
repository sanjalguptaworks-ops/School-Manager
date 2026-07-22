import { Router } from "express";
import {
  db,
  homeworkTable,
  homeworkCompletionsTable,
  classesTable,
  studentsTable,
  parentStudentsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

const router = Router();

async function getOwnStudentId(authUserId: number): Promise<number | null> {
  const [s] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
  return s?.id ?? null;
}

// GET /homework — admin sees everything in the school; teachers are scoped to
// their assigned classes (or everything, if unassigned); students see only
// their own class; parents see a specific child's class via ?studentId=.
router.get("/homework", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId, month, studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;

    const filters: any[] = [eq(homeworkTable.schoolId, schoolId)];
    let completionStudentId: number | null = null;

    if (role === "student") {
      const ownId = await getOwnStudentId(authUserId);
      if (!ownId) { res.json([]); return; }
      completionStudentId = ownId;
      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.id, ownId)).limit(1);
      if (!s) { res.json([]); return; }
      filters.push(eq(homeworkTable.classId, s.classId));
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
        completionStudentId = match.studentId;
        filters.push(eq(homeworkTable.classId, match.classId));
      } else {
        completionStudentId = children[0]!.studentId;
        filters.push(inArray(homeworkTable.classId, children.map((c) => c.classId)));
      }
    } else if (role === "teacher") {
      const classScope = await getTeacherClassScope(authUserId);
      if (classId && !canAccessClass(classScope, parseInt(classId))) { res.status(403).json({ error: "Forbidden" }); return; }
      if (classScope.kind === "restricted" && classScope.classIds.length === 0) { res.json([]); return; }
      if (classId) filters.push(eq(homeworkTable.classId, parseInt(classId)));
      else if (classScope.kind === "restricted") filters.push(inArray(homeworkTable.classId, classScope.classIds));
    } else {
      // admin
      if (classId) filters.push(eq(homeworkTable.classId, parseInt(classId)));
    }

    if (month) filters.push(sql`to_char(${homeworkTable.dueDate}::date, 'YYYY-MM') = ${month}`);

    const completionJoin = completionStudentId
      ? and(eq(homeworkCompletionsTable.homeworkId, homeworkTable.id), eq(homeworkCompletionsTable.studentId, completionStudentId))
      : sql`false`;

    const rows = await db
      .select({
        id: homeworkTable.id,
        classId: homeworkTable.classId,
        title: homeworkTable.title,
        description: homeworkTable.description,
        dueDate: homeworkTable.dueDate,
        attachmentUrl: homeworkTable.attachmentUrl,
        createdAt: homeworkTable.createdAt,
        class: { id: classesTable.id, name: classesTable.name, section: classesTable.section },
        completed: completionStudentId ? sql<boolean>`${homeworkCompletionsTable.id} is not null` : sql<boolean>`false`,
        submissionUrl: homeworkCompletionsTable.submissionUrl,
        completedCount: sql<number>`(select count(*)::int from homework_completions hc where hc.homework_id = ${homeworkTable.id})`,
      })
      .from(homeworkTable)
      .innerJoin(classesTable, eq(homeworkTable.classId, classesTable.id))
      .leftJoin(homeworkCompletionsTable, completionJoin)
      .where(and(...filters))
      .orderBy(homeworkTable.dueDate);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /homework — admin or teacher
router.post("/homework", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { classId, title, description, dueDate, attachmentUrl } = req.body;
      if (!classId || !title?.trim() || !dueDate) {
        res.status(400).json({ error: "classId, title and dueDate are required" });
        return;
      }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }

      const [homework] = await db
        .insert(homeworkTable)
        .values({
          classId,
          title: title.trim(),
          description: description?.trim() || null,
          dueDate,
          attachmentUrl: attachmentUrl?.trim() || null,
          schoolId,
          createdBy: authUserId,
        })
        .returning();

      res.status(201).json(homework);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /homework/:id — admin, or teacher scoped to that class
router.delete("/homework/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;

      const [existing] = await db
        .select({ id: homeworkTable.id, classId: homeworkTable.classId })
        .from(homeworkTable)
        .where(and(eq(homeworkTable.id, id), eq(homeworkTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, existing.classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      await db.delete(homeworkTable).where(eq(homeworkTable.id, id));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /homework/:id/complete — student marks their own homework done
router.post("/homework/:id/complete", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["student"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;

      const { submissionUrl } = req.body || {};

      const ownId = await getOwnStudentId(authUserId);
      if (!ownId) { res.status(403).json({ error: "Forbidden" }); return; }

      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.id, ownId)).limit(1);
      const [hw] = await db
        .select({ id: homeworkTable.id, classId: homeworkTable.classId })
        .from(homeworkTable)
        .where(and(eq(homeworkTable.id, id), eq(homeworkTable.schoolId, schoolId)))
        .limit(1);
      if (!hw || !s || hw.classId !== s.classId) { res.status(404).json({ error: "Not found" }); return; }

      // onConflictDoUpdate (rather than doNothing) so a student can attach
      // or replace their submission photo after already marking complete.
      await db
        .insert(homeworkCompletionsTable)
        .values({ homeworkId: id, studentId: ownId, submissionUrl: submissionUrl || null })
        .onConflictDoUpdate({
          target: [homeworkCompletionsTable.homeworkId, homeworkCompletionsTable.studentId],
          set: { submissionUrl: submissionUrl || null },
        });

      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /homework/:id/complete — student unmarks (toggle back to incomplete)
router.delete("/homework/:id/complete", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["student"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const authUserId = (req as any).authUserId;
      const ownId = await getOwnStudentId(authUserId);
      if (!ownId) { res.status(403).json({ error: "Forbidden" }); return; }

      await db
        .delete(homeworkCompletionsTable)
        .where(and(eq(homeworkCompletionsTable.homeworkId, id), eq(homeworkCompletionsTable.studentId, ownId)));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
