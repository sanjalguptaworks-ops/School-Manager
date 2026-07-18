import { Router } from "express";
import { db, attendanceTable, studentsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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
        user: sql<any>`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'role', ${usersTable.role})`,
      },
    })
    .from(attendanceTable)
    .leftJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(filters.length ? and(...filters) : undefined);
}

// GET /attendance
router.get("/attendance", requireAuth, async (req, res) => {
  try {
    const { classId, studentId, date, month } = req.query as Record<string, string>;
    const filters: any[] = [];
    if (classId) filters.push(eq(attendanceTable.classId, parseInt(classId)));
    if (studentId) filters.push(eq(attendanceTable.studentId, parseInt(studentId)));
    if (date) filters.push(eq(attendanceTable.date, date));
    if (month) filters.push(sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}`);

    const rows = await buildAttendanceQuery(filters);
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /attendance/bulk
router.post("/attendance/bulk", requireAuth, async (req, res) => {
  try {
    const { classId, date, records } = req.body;
    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({ error: "classId, date, records required" });
    }
    const markedBy = (req as any).authUserId || null;

    // Upsert each record
    const values = records.map((r: any) => ({
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

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /attendance/:id
router.patch("/attendance/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status required" });
    const [updated] = await db
      .update(attendanceTable)
      .set({ status })
      .where(eq(attendanceTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
