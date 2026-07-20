import { Router } from "express";
import { db, marksTable, studentsTable, examsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

// GET /marks
router.get("/marks", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const { examId, studentId } = req.query as Record<string, string>;
    const filters: any[] = [eq(classesTable.schoolId, schoolId)];
    if (examId) filters.push(eq(marksTable.examId, parseInt(examId)));
    if (studentId) filters.push(eq(marksTable.studentId, parseInt(studentId)));

    const rows = await db
      .select({
        id: marksTable.id,
        examId: marksTable.examId,
        studentId: marksTable.studentId,
        marksObtained: marksTable.marksObtained,
        student: sql<any>`json_build_object('id', ${studentsTable.id}, 'rollNo', ${studentsTable.rollNo}, 'user', json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}))`,
      })
      .from(marksTable)
      .innerJoin(examsTable, eq(marksTable.examId, examsTable.id))
      .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
      .leftJoin(studentsTable, eq(marksTable.studentId, studentsTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .where(and(...filters));

    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /marks/bulk — admin or teacher
router.post("/marks/bulk", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { examId, records } = req.body;
      if (!examId || !Array.isArray(records)) {
        res.status(400).json({ error: "examId and records required" });
        return;
      }

      const [exam] = await db
        .select({ id: examsTable.id, classId: examsTable.classId })
        .from(examsTable)
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .where(and(eq(examsTable.id, examId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!exam) { res.status(400).json({ error: "Invalid examId" }); return; }

      const studentIds = records.map((r: any) => r.studentId);
      const validStudents = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(and(eq(studentsTable.classId, exam.classId), inArray(studentsTable.id, studentIds)));
      const validIds = new Set(validStudents.map((s) => s.id));
      const filteredRecords = records.filter((r: any) => validIds.has(r.studentId));
      if (filteredRecords.length === 0) {
        res.json([]);
        return;
      }

      const values = filteredRecords.map((r: any) => ({
        examId,
        studentId: r.studentId,
        marksObtained: String(r.marksObtained),
      }));

      const result = await db
        .insert(marksTable)
        .values(values)
        .onConflictDoUpdate({
          target: [marksTable.examId, marksTable.studentId],
          set: { marksObtained: sql`excluded.marks_obtained` },
        })
        .returning();

      res.json(result);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /marks/report/:studentId
router.get("/marks/report/:studentId", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const studentId = parseInt(req.params['studentId'] as string);

    // Get student info, scoped to this school
    const studentRows = await db
      .select({
        id: studentsTable.id,
        userId: studentsTable.userId,
        classId: studentsTable.classId,
        rollNo: studentsTable.rollNo,
        dob: studentsTable.dob,
        guardianName: studentsTable.guardianName,
        guardianContact: studentsTable.guardianContact,
        user: sql<any>`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'role', ${usersTable.role})`,
      })
      .from(studentsTable)
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(and(eq(studentsTable.id, studentId), eq(classesTable.schoolId, schoolId)))
      .limit(1);

    if (!studentRows[0]) return res.status(404).json({ error: "Student not found" });

    // Get all marks with exam info
    const markRows = await db
      .select({
        marksObtained: marksTable.marksObtained,
        exam: {
          id: examsTable.id,
          name: examsTable.name,
          subject: examsTable.subject,
          date: examsTable.date,
          maxMarks: examsTable.maxMarks,
          classId: examsTable.classId,
        },
      })
      .from(marksTable)
      .leftJoin(examsTable, eq(marksTable.examId, examsTable.id))
      .where(eq(marksTable.studentId, studentId));

    const results = markRows.map((row) => ({
      exam: row.exam,
      marksObtained: parseFloat(row.marksObtained as string),
      percentage:
        row.exam?.maxMarks
          ? Math.round((parseFloat(row.marksObtained as string) / row.exam.maxMarks) * 100 * 10) / 10
          : 0,
    }));

    return res.json({ student: studentRows[0], results });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
