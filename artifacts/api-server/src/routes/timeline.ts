import { Router } from "express";
import {
  db,
  usersTable,
  studentsTable,
  parentStudentsTable,
  noticesTable,
  eventsTable,
  homeworkTable,
  galleryAlbumsTable,
  pollsTable,
} from "@workspace/db";
import { eq, and, sql, inArray, isNull, or } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";

const router = Router();

type TimelineItem = {
  id: string;
  type: "notice" | "event" | "homework" | "gallery" | "poll";
  title: string;
  subtitle: string | null;
  date: string;
  link: string;
};

// GET /timeline — a merged, reverse-chronological feed of notices, events,
// homework, gallery albums and polls for a parent or student's own class(es)
// (or a specific child, via ?studentId=, for a parent with more than one).
// Not meaningful for admin/teacher, who have their own dedicated views for
// each of these features already.
router.get("/timeline", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;
    if (role !== "student" && role !== "parent") { res.status(403).json({ error: "Forbidden" }); return; }

    let classIds: number[];
    let targetRole: "students" | "parents";

    if (role === "student") {
      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
      if (!s) { res.json([]); return; }
      classIds = [s.classId];
      targetRole = "students";
    } else {
      const children = await db
        .select({ studentId: parentStudentsTable.studentId, classId: studentsTable.classId })
        .from(parentStudentsTable)
        .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
        .where(eq(parentStudentsTable.parentId, authUserId));
      if (children.length === 0) { res.json([]); return; }

      if (studentId) {
        const match = children.find((c) => c.studentId === parseInt(studentId));
        if (!match) { res.status(403).json({ error: "Forbidden" }); return; }
        classIds = [match.classId];
      } else {
        classIds = children.map((c) => c.classId);
      }
      targetRole = "parents";
    }

    const classOrWhole = (classIdCol: any) => or(isNull(classIdCol), inArray(classIdCol, classIds));

    const [notices, events, homework, albums, polls] = await Promise.all([
      db
        .select({ id: noticesTable.id, title: noticesTable.title, body: noticesTable.body, createdAt: noticesTable.createdAt })
        .from(noticesTable)
        .where(
          and(
            eq(noticesTable.schoolId, schoolId),
            classOrWhole(noticesTable.classId),
            or(eq(noticesTable.targetRole, "all"), eq(noticesTable.targetRole, targetRole)),
          ),
        ),
      db
        .select({ id: eventsTable.id, title: eventsTable.title, description: eventsTable.description, date: eventsTable.date })
        .from(eventsTable)
        .where(and(eq(eventsTable.schoolId, schoolId), classOrWhole(eventsTable.classId))),
      db
        .select({ id: homeworkTable.id, title: homeworkTable.title, dueDate: homeworkTable.dueDate, createdAt: homeworkTable.createdAt })
        .from(homeworkTable)
        .where(and(eq(homeworkTable.schoolId, schoolId), inArray(homeworkTable.classId, classIds))),
      db
        .select({
          id: galleryAlbumsTable.id,
          title: galleryAlbumsTable.title,
          albumDate: galleryAlbumsTable.albumDate,
          photoCount: sql<number>`(select count(*)::int from gallery_photos gp where gp.album_id = gallery_albums.id)`,
        })
        .from(galleryAlbumsTable)
        .where(and(eq(galleryAlbumsTable.schoolId, schoolId), classOrWhole(galleryAlbumsTable.classId))),
      db
        .select({ id: pollsTable.id, question: pollsTable.question, createdAt: pollsTable.createdAt })
        .from(pollsTable)
        .where(and(eq(pollsTable.schoolId, schoolId), classOrWhole(pollsTable.classId))),
    ]);

    const items: TimelineItem[] = [
      ...notices.map((n): TimelineItem => ({
        id: `notice-${n.id}`,
        type: "notice",
        title: n.title,
        subtitle: n.body.slice(0, 140),
        date: n.createdAt.toISOString(),
        link: "/notices",
      })),
      ...events.map((e): TimelineItem => ({
        id: `event-${e.id}`,
        type: "event",
        title: e.title,
        subtitle: e.description,
        date: new Date(e.date).toISOString(),
        link: "/events",
      })),
      ...homework.map((hw): TimelineItem => ({
        id: `homework-${hw.id}`,
        type: "homework",
        title: hw.title,
        subtitle: `Due ${new Date(hw.dueDate).toLocaleDateString()}`,
        date: hw.createdAt.toISOString(),
        link: "/homework",
      })),
      ...albums.map((a): TimelineItem => ({
        id: `gallery-${a.id}`,
        type: "gallery",
        title: a.title,
        subtitle: `${a.photoCount} photo${a.photoCount === 1 ? "" : "s"}`,
        date: new Date(a.albumDate).toISOString(),
        link: `/gallery/${a.id}`,
      })),
      ...polls.map((p): TimelineItem => ({
        id: `poll-${p.id}`,
        type: "poll",
        title: p.question,
        subtitle: "Tap to vote",
        date: p.createdAt.toISOString(),
        link: "/polls",
      })),
    ];

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(items.slice(0, 30));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
