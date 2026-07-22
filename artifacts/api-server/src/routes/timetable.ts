import { Router } from "express";
import { db, timetableSlotsTable, classesTable, teachersTable, usersTable, studentsTable, parentStudentsTable, WEEKDAYS } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

const router = Router();

function selectFields() {
  return {
    id: timetableSlotsTable.id,
    classId: timetableSlotsTable.classId,
    dayOfWeek: timetableSlotsTable.dayOfWeek,
    periodNumber: timetableSlotsTable.periodNumber,
    subject: timetableSlotsTable.subject,
    teacherId: timetableSlotsTable.teacherId,
  };
}

async function getOwnTeacherId(authUserId: number): Promise<number | null> {
  const [t] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, authUserId)).limit(1);
  return t?.id ?? null;
}

async function getOwnStudentClassId(authUserId: number): Promise<number | null> {
  const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
  return s?.classId ?? null;
}

// GET /timetable
// ?classId=X -- that class's full weekly grid (admin any class; teacher
// scoped to their assigned classes; student/parent only their own/child's
// class).
// no classId -- a role-appropriate default: teacher gets "my periods" across
// every class they teach; student/parent get their own/child's class.
router.get("/timetable", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId, studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;

    const teacherJoinFields = {
      ...selectFields(),
      class: { id: classesTable.id, name: classesTable.name, section: classesTable.section },
      teacher: { id: teachersTable.id, name: usersTable.name },
    };

    if (!classId && role === "teacher") {
      const ownTeacherId = await getOwnTeacherId(authUserId);
      if (!ownTeacherId) { res.json([]); return; }
      const rows = await db
        .select(teacherJoinFields)
        .from(timetableSlotsTable)
        .innerJoin(classesTable, eq(timetableSlotsTable.classId, classesTable.id))
        .leftJoin(teachersTable, eq(timetableSlotsTable.teacherId, teachersTable.id))
        .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(and(eq(timetableSlotsTable.schoolId, schoolId), eq(timetableSlotsTable.teacherId, ownTeacherId)))
        .orderBy(asc(timetableSlotsTable.dayOfWeek), asc(timetableSlotsTable.periodNumber));
      res.json(rows);
      return;
    }

    let targetClassId: number;

    if (classId) {
      targetClassId = parseInt(classId);
      if (role === "teacher") {
        const classScope = await getTeacherClassScope(authUserId);
        if (!canAccessClass(classScope, targetClassId)) { res.status(403).json({ error: "Forbidden" }); return; }
      } else if (role === "student") {
        const ownClassId = await getOwnStudentClassId(authUserId);
        if (ownClassId !== targetClassId) { res.status(403).json({ error: "Forbidden" }); return; }
      } else if (role === "parent") {
        const children = await db
          .select({ studentId: parentStudentsTable.studentId, classId: studentsTable.classId })
          .from(parentStudentsTable)
          .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
          .where(eq(parentStudentsTable.parentId, authUserId));
        if (!children.some((c) => c.classId === targetClassId)) { res.status(403).json({ error: "Forbidden" }); return; }
      }
    } else if (role === "student") {
      const ownClassId = await getOwnStudentClassId(authUserId);
      if (!ownClassId) { res.json([]); return; }
      targetClassId = ownClassId;
    } else if (role === "parent") {
      const children = await db
        .select({ studentId: parentStudentsTable.studentId, classId: studentsTable.classId })
        .from(parentStudentsTable)
        .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
        .where(eq(parentStudentsTable.parentId, authUserId));
      if (children.length === 0) { res.json([]); return; }
      const match = studentId ? children.find((c) => c.studentId === parseInt(studentId)) : children[0];
      if (!match) { res.status(403).json({ error: "Forbidden" }); return; }
      targetClassId = match.classId;
    } else {
      res.status(400).json({ error: "classId is required" });
      return;
    }

    const rows = await db
      .select(teacherJoinFields)
      .from(timetableSlotsTable)
      .innerJoin(classesTable, eq(timetableSlotsTable.classId, classesTable.id))
      .leftJoin(teachersTable, eq(timetableSlotsTable.teacherId, teachersTable.id))
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(and(eq(timetableSlotsTable.schoolId, schoolId), eq(timetableSlotsTable.classId, targetClassId)))
      .orderBy(asc(timetableSlotsTable.dayOfWeek), asc(timetableSlotsTable.periodNumber));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /timetable — admin only. Upserts on (classId, dayOfWeek, periodNumber)
// so re-saving a grid cell just replaces it.
router.post("/timetable", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { classId, dayOfWeek, periodNumber, subject, teacherId } = req.body;

      if (!classId || !dayOfWeek || !periodNumber || !subject?.trim()) {
        res.status(400).json({ error: "classId, dayOfWeek, periodNumber and subject are required" });
        return;
      }
      if (!WEEKDAYS.includes(dayOfWeek)) {
        res.status(400).json({ error: `dayOfWeek must be one of: ${WEEKDAYS.join(", ")}` });
        return;
      }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }

      if (teacherId) {
        const [teacher] = await db
          .select({ id: teachersTable.id })
          .from(teachersTable)
          .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
          .where(and(eq(teachersTable.id, teacherId), eq(usersTable.schoolId, schoolId)))
          .limit(1);
        if (!teacher) { res.status(400).json({ error: "Invalid teacherId" }); return; }
      }

      const [slot] = await db
        .insert(timetableSlotsTable)
        .values({ classId, dayOfWeek, periodNumber, subject: subject.trim(), teacherId: teacherId || null, schoolId })
        .onConflictDoUpdate({
          target: [timetableSlotsTable.classId, timetableSlotsTable.dayOfWeek, timetableSlotsTable.periodNumber],
          set: { subject: subject.trim(), teacherId: teacherId || null },
        })
        .returning();

      res.status(201).json(slot);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /timetable/:id — admin only, clears a slot
router.delete("/timetable/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;

      const [deleted] = await db
        .delete(timetableSlotsTable)
        .where(and(eq(timetableSlotsTable.id, id), eq(timetableSlotsTable.schoolId, schoolId)))
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
