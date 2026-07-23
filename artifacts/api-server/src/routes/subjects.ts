import { Router } from "express";
import { db, timetableSlotsTable, teachersTable, usersTable, studentsTable, parentStudentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";

const router = Router();

// GET /subjects — read-only rollup of which subjects a student's class is
// taught and by whom, derived from the timetable rather than a separate
// schema (a class's timetable_slots already carries subject + teacherId).
router.get("/subjects", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;
    if (role !== "student" && role !== "parent") { res.status(403).json({ error: "Forbidden" }); return; }

    let classId: number;

    if (role === "student") {
      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
      if (!s) { res.json([]); return; }
      classId = s.classId;
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
        classId = match.classId;
      } else {
        classId = children[0]!.classId;
      }
    }

    const rows = await db
      .selectDistinctOn([timetableSlotsTable.subject], {
        subject: timetableSlotsTable.subject,
        teacherId: timetableSlotsTable.teacherId,
        teacherName: usersTable.name,
        teacherAvatarUrl: usersTable.avatarUrl,
      })
      .from(timetableSlotsTable)
      .leftJoin(teachersTable, eq(timetableSlotsTable.teacherId, teachersTable.id))
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(and(eq(timetableSlotsTable.classId, classId), eq(timetableSlotsTable.schoolId, schoolId)))
      .orderBy(timetableSlotsTable.subject, sql`${usersTable.name} nulls last`);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
