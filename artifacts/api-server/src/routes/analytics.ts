import { Router } from "express";
import { db, attendanceTable, classesTable, marksTable, examsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

function monthsAgoDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(1);
  return d.toISOString().split("T")[0] as string;
}

function parseMonths(raw: unknown): number {
  return Math.max(1, Math.min(24, parseInt(raw as string) || 6));
}

// GET /analytics/attendance-trends?months=6 — admin only. Monthly
// school-wide attendance rate over the last N months.
router.get("/analytics/attendance-trends", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const months = parseMonths(req.query["months"]);
      const cutoff = monthsAgoDate(months - 1);

      const rows = await db
        .select({
          month: sql<string>`to_char(${attendanceTable.date}::date, 'YYYY-MM')`,
          present: sql<number>`count(*) filter (where ${attendanceTable.status} = 'present')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(attendanceTable)
        .innerJoin(classesTable, eq(attendanceTable.classId, classesTable.id))
        .where(and(eq(classesTable.schoolId, schoolId), gte(attendanceTable.date, cutoff)))
        .groupBy(sql`to_char(${attendanceTable.date}::date, 'YYYY-MM')`)
        .orderBy(sql`to_char(${attendanceTable.date}::date, 'YYYY-MM')`);

      res.json(
        rows.map((r) => ({
          month: r.month,
          attendanceRate: r.total > 0 ? Math.round((r.present / r.total) * 1000) / 10 : 0,
          totalRecords: r.total,
        })),
      );
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /analytics/performance-trends?months=6 — admin only. Monthly average
// exam score (as a percentage of max marks) over the last N months.
router.get("/analytics/performance-trends", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const months = parseMonths(req.query["months"]);
      const cutoff = monthsAgoDate(months - 1);

      const rows = await db
        .select({
          month: sql<string>`to_char(${examsTable.date}::date, 'YYYY-MM')`,
          avgPercentage: sql<number>`round(avg(${marksTable.marksObtained} / ${examsTable.maxMarks} * 100)::numeric, 1)`,
          examCount: sql<number>`count(distinct ${examsTable.id})::int`,
        })
        .from(marksTable)
        .innerJoin(examsTable, eq(marksTable.examId, examsTable.id))
        .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
        .where(and(eq(classesTable.schoolId, schoolId), gte(examsTable.date, cutoff)))
        .groupBy(sql`to_char(${examsTable.date}::date, 'YYYY-MM')`)
        .orderBy(sql`to_char(${examsTable.date}::date, 'YYYY-MM')`);

      res.json(rows);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
