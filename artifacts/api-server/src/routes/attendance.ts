import { Router } from "express";
import { db, attendanceTable, studentsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

const router = Router();

async function buildAttendanceQuery(filters: any[] = []) {
  return db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      classId: attendanceTable.classId,
      date: attendanceTable.date,
      status: attendanceTable.status,
      markedBy: attendanceTable.markedBy,
      student: {
        id: studentsTable.id,
        userId: studentsTable.userId,
        classId: studentsTable.classId,
        rollNo: studentsTable.rollNo,
        dob: studentsTable.dob,
        guardianName: studentsTable.guardianName,
        guardianContact: studentsTable.guardianContact,
        user: sql<any>`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'role', ${usersTable.role}, 'avatarUrl', ${usersTable.avatarUrl})`,
      },
    })
    .from(attendanceTable)
    .innerJoin(classesTable, eq(attendanceTable.classId, classesTable.id))
    .leftJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(filters.length ? and(...filters) : undefined);
}

// GET /attendance
router.get("/attendance", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId, studentId, date, month } = req.query as Record<string, string>;

    const scope = await getStudentAccessScope(authUserId);
    if (studentId && !canAccessStudent(scope, parseInt(studentId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (scope.kind === "restricted" && scope.studentIds.length === 0) {
      return res.json([]);
    }

    const classScope = await getTeacherClassScope(authUserId);
    if (classId && !canAccessClass(classScope, parseInt(classId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (classScope.kind === "restricted" && classScope.classIds.length === 0) {
      return res.json([]);
    }

    const filters: any[] = [eq(classesTable.schoolId, schoolId)];
    if (classId) filters.push(eq(attendanceTable.classId, parseInt(classId)));
    else if (classScope.kind === "restricted") filters.push(inArray(attendanceTable.classId, classScope.classIds));
    if (studentId) filters.push(eq(attendanceTable.studentId, parseInt(studentId)));
    else if (scope.kind === "restricted") filters.push(inArray(attendanceTable.studentId, scope.studentIds));
    if (date) filters.push(eq(attendanceTable.date, date));
    if (month) filters.push(sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}`);

    const rows = await buildAttendanceQuery(filters);
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /attendance/bulk — admin or teacher
router.post("/attendance/bulk", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { classId, date, records } = req.body;
      if (!classId || !date || !Array.isArray(records)) {
        res.status(400).json({ error: "classId, date, records required" });
        return;
      }
      const markedBy = authUserId || null;

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, classId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }

      const studentIds = records.map((r: any) => r.studentId);
      const validStudents = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(and(eq(studentsTable.classId, classId), inArray(studentsTable.id, studentIds)));
      const validIds = new Set(validStudents.map((s) => s.id));
      const filteredRecords = records.filter((r: any) => validIds.has(r.studentId));
      if (filteredRecords.length === 0) {
        res.json([]);
        return;
      }

      // Upsert each record
      const values = filteredRecords.map((r: any) => ({
        studentId: r.studentId,
        classId,
        date,
        status: r.status,
        markedBy,
      }));

      const result = await db
        .insert(attendanceTable)
        .values(values)
        .onConflictDoUpdate({
          target: [attendanceTable.studentId, attendanceTable.date],
          set: { status: sql`excluded.status`, markedBy: sql`excluded.marked_by` },
        })
        .returning();

      res.json(result);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// PATCH /attendance/:id — admin or teacher
router.patch("/attendance/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { status } = req.body;
      if (!status) { res.status(400).json({ error: "status required" }); return; }

      const [existing] = await db
        .select({ id: attendanceTable.id, classId: attendanceTable.classId })
        .from(attendanceTable)
        .innerJoin(classesTable, eq(attendanceTable.classId, classesTable.id))
        .where(and(eq(attendanceTable.id, id), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, existing.classId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const [updated] = await db
        .update(attendanceTable)
        .set({ status })
        .where(eq(attendanceTable.id, id))
        .returning();
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }
      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
