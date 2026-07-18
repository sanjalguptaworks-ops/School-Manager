import { Router } from "express";
import {
  db,
  parentStudentsTable,
  studentsTable,
  usersTable,
  classesTable,
  attendanceTable,
  marksTable,
  examsTable,
  feePaymentsTable,
  feeStructuresTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /parents/:parentId/students  — list children linked to a parent
router.get("/parents/:parentId/students", requireAuth, async (req, res): Promise<void> => {
  try {
    const parentId = parseInt(req.params["parentId"] as string);

    const rows = await db
      .select({
        id: studentsTable.id,
        userId: studentsTable.userId,
        classId: studentsTable.classId,
        rollNo: studentsTable.rollNo,
        dob: studentsTable.dob,
        guardianName: studentsTable.guardianName,
        guardianContact: studentsTable.guardianContact,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
        class: {
          id: classesTable.id,
          name: classesTable.name,
          section: classesTable.section,
        },
      })
      .from(parentStudentsTable)
      .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(eq(parentStudentsTable.parentId, parentId));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /parents/:parentId/link-student
router.post("/parents/:parentId/link-student", requireAuth, async (req, res): Promise<void> => {
  try {
    const parentId = parseInt(req.params["parentId"] as string);
    const { studentId } = req.body;
    if (!studentId) {
      res.status(400).json({ error: "studentId required" });
      return;
    }
    await db
      .insert(parentStudentsTable)
      .values({ parentId, studentId })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /parents/:parentId/link-student/:studentId
router.delete("/parents/:parentId/link-student/:studentId", requireAuth, async (req, res): Promise<void> => {
  try {
    const parentId = parseInt(req.params["parentId"] as string);
    const studentId = parseInt(req.params["studentId"] as string);
    await db
      .delete(parentStudentsTable)
      .where(and(eq(parentStudentsTable.parentId, parentId), eq(parentStudentsTable.studentId, studentId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /students/:studentId/summary  — attendance + marks + fee summary for a student
router.get("/students/:studentId/summary", requireAuth, async (req, res): Promise<void> => {
  try {
    const studentId = parseInt(req.params["studentId"] as string);

    // Attendance totals
    const [attendance] = await db
      .select({
        total: sql<number>`count(*)::int`,
        present: sql<number>`count(*) filter (where ${attendanceTable.status} = 'present')::int`,
        absent: sql<number>`count(*) filter (where ${attendanceTable.status} = 'absent')::int`,
        late: sql<number>`count(*) filter (where ${attendanceTable.status} = 'late')::int`,
      })
      .from(attendanceTable)
      .where(eq(attendanceTable.studentId, studentId));

    const attendanceRate = attendance.total > 0
      ? Math.round(((attendance.present + attendance.late) / attendance.total) * 100 * 10) / 10
      : 0;

    // Marks + exams
    const markRows = await db
      .select({
        marksObtained: marksTable.marksObtained,
        exam: {
          id: examsTable.id,
          name: examsTable.name,
          subject: examsTable.subject,
          date: examsTable.date,
          maxMarks: examsTable.maxMarks,
        },
      })
      .from(marksTable)
      .leftJoin(examsTable, eq(marksTable.examId, examsTable.id))
      .where(eq(marksTable.studentId, studentId))
      .orderBy(sql`${examsTable.date} desc`);

    // Fee status
    const feeRows = await db
      .select({
        id: feePaymentsTable.id,
        status: feePaymentsTable.status,
        paidOn: feePaymentsTable.paidOn,
        amount: feeStructuresTable.amount,
        term: feeStructuresTable.term,
        dueDate: feeStructuresTable.dueDate,
      })
      .from(feePaymentsTable)
      .leftJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id))
      .where(eq(feePaymentsTable.studentId, studentId));

    const pendingFees = feeRows.filter((f) => f.status === "pending").length;
    const paidFees = feeRows.filter((f) => f.status === "paid").length;

    // Upcoming exams (from student's class)
    const [studentRow] = await db
      .select({ classId: studentsTable.classId })
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId))
      .limit(1);

    const upcomingExams = studentRow
      ? await db
          .select({
            id: examsTable.id,
            name: examsTable.name,
            subject: examsTable.subject,
            date: examsTable.date,
            maxMarks: examsTable.maxMarks,
          })
          .from(examsTable)
          .where(
            and(
              eq(examsTable.classId, studentRow.classId),
              sql`${examsTable.date} >= current_date`,
            ),
          )
          .orderBy(examsTable.date)
          .limit(5)
      : [];

    res.json({
      attendance: { ...attendance, attendanceRate },
      recentMarks: markRows.slice(0, 5).map((r) => ({
        exam: r.exam,
        marksObtained: parseFloat(r.marksObtained as string),
        percentage: r.exam?.maxMarks
          ? Math.round((parseFloat(r.marksObtained as string) / r.exam.maxMarks) * 100 * 10) / 10
          : 0,
      })),
      fees: { total: feeRows.length, pending: pendingFees, paid: paidFees, rows: feeRows },
      upcomingExams,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
