import { Router } from "express";
import {
  db,
  studentsTable,
  teachersTable,
  classesTable,
  attendanceTable,
  feePaymentsTable,
  feeStructuresTable,
  noticesTable,
  usersTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /dashboard/summary
router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [[students], [teachers], [classes]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(studentsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(teachersTable),
      db.select({ count: sql<number>`count(*)::int` }).from(classesTable),
    ]);

    // Attendance rate today
    const [attendanceToday] = await db
      .select({
        total: sql<number>`count(*)::int`,
        present: sql<number>`count(*) filter (where status = 'present')::int`,
      })
      .from(attendanceTable)
      .where(eq(attendanceTable.date, today));

    const attendanceRateToday =
      attendanceToday.total > 0
        ? Math.round((attendanceToday.present / attendanceToday.total) * 100 * 10) / 10
        : 0;

    // Fee overview
    const [feeStats] = await db
      .select({
        pendingCount: sql<number>`count(*) filter (where ${feePaymentsTable.status} = 'pending')::int`,
        collectedAmount: sql<number>`coalesce(sum(${feeStructuresTable.amount}::numeric) filter (where ${feePaymentsTable.status} = 'paid'), 0)::numeric`,
        pendingAmount: sql<number>`coalesce(sum(${feeStructuresTable.amount}::numeric) filter (where ${feePaymentsTable.status} = 'pending'), 0)::numeric`,
      })
      .from(feePaymentsTable)
      .leftJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id));

    return res.json({
      totalStudents: students.count,
      totalTeachers: teachers.count,
      totalClasses: classes.count,
      attendanceRateToday,
      pendingFeesCount: feeStats.pendingCount,
      collectedAmount: parseFloat(String(feeStats.collectedAmount)),
      pendingAmount: parseFloat(String(feeStats.pendingAmount)),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/attendance-summary
router.get("/dashboard/attendance-summary", requireAuth, async (req, res) => {
  try {
    const { date } = req.query as { date?: string };
    if (!date) return res.status(400).json({ error: "date required" });

    const rows = await db
      .select({
        classId: classesTable.id,
        className: classesTable.name,
        section: classesTable.section,
        present: sql<number>`count(*) filter (where ${attendanceTable.status} = 'present')::int`,
        absent: sql<number>`count(*) filter (where ${attendanceTable.status} = 'absent')::int`,
        late: sql<number>`count(*) filter (where ${attendanceTable.status} = 'late')::int`,
        total: sql<number>`count(${attendanceTable.id})::int`,
      })
      .from(classesTable)
      .leftJoin(
        attendanceTable,
        sql`${attendanceTable.classId} = ${classesTable.id} and ${attendanceTable.date} = ${date}`,
      )
      .groupBy(classesTable.id);

    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/recent-notices
router.get("/dashboard/recent-notices", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: noticesTable.id,
        title: noticesTable.title,
        body: noticesTable.body,
        targetRole: noticesTable.targetRole,
        classId: noticesTable.classId,
        createdBy: noticesTable.createdBy,
        createdAt: noticesTable.createdAt,
        createdByUser: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
      })
      .from(noticesTable)
      .leftJoin(usersTable, eq(noticesTable.createdBy, usersTable.id))
      .orderBy(sql`${noticesTable.createdAt} desc`)
      .limit(5);
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /dashboard/fee-overview
router.get("/dashboard/fee-overview", requireAuth, async (req, res) => {
  try {
    const [stats] = await db
      .select({
        totalDue: sql<number>`coalesce(sum(${feeStructuresTable.amount}::numeric), 0)::numeric`,
        totalCollected: sql<number>`coalesce(sum(${feeStructuresTable.amount}::numeric) filter (where ${feePaymentsTable.status} = 'paid'), 0)::numeric`,
        totalPending: sql<number>`coalesce(sum(${feeStructuresTable.amount}::numeric) filter (where ${feePaymentsTable.status} = 'pending'), 0)::numeric`,
        paidCount: sql<number>`count(*) filter (where ${feePaymentsTable.status} = 'paid')::int`,
        pendingCount: sql<number>`count(*) filter (where ${feePaymentsTable.status} = 'pending')::int`,
      })
      .from(feePaymentsTable)
      .leftJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id));

    return res.json({
      totalDue: parseFloat(String(stats.totalDue)),
      totalCollected: parseFloat(String(stats.totalCollected)),
      totalPending: parseFloat(String(stats.totalPending)),
      paidCount: stats.paidCount,
      pendingCount: stats.pendingCount,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
