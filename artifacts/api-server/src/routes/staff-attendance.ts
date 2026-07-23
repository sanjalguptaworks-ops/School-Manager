import { Router } from "express";
import { db, staffAttendanceTable, teachersTable, usersTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

async function buildStaffAttendanceQuery(filters: any[] = []) {
  return db
    .select({
      id: staffAttendanceTable.id,
      teacherId: staffAttendanceTable.teacherId,
      date: staffAttendanceTable.date,
      status: staffAttendanceTable.status,
      markedBy: staffAttendanceTable.markedBy,
      teacher: {
        id: teachersTable.id,
        userId: teachersTable.userId,
        user: sql<any>`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'avatarUrl', ${usersTable.avatarUrl})`,
      },
    })
    .from(staffAttendanceTable)
    .innerJoin(teachersTable, eq(staffAttendanceTable.teacherId, teachersTable.id))
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(filters.length ? and(...filters) : undefined);
}

// GET /staff-attendance — admin/teacher (own record only, unless admin).
router.get("/staff-attendance", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const dbUser = (req as any).dbUser;
      const { teacherId, date, month } = req.query as Record<string, string>;

      const filters: any[] = [eq(staffAttendanceTable.schoolId, schoolId)];

      if (dbUser.role === "teacher") {
        const [self] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, authUserId)).limit(1);
        if (!self) { res.json([]); return; }
        filters.push(eq(staffAttendanceTable.teacherId, self.id));
      } else if (teacherId) {
        filters.push(eq(staffAttendanceTable.teacherId, parseInt(teacherId)));
      }

      if (date) filters.push(eq(staffAttendanceTable.date, date));
      if (month) filters.push(sql`to_char(${staffAttendanceTable.date}::date, 'YYYY-MM') = ${month}`);

      const rows = await buildStaffAttendanceQuery(filters);
      res.json(rows);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /staff-attendance/bulk — admin only.
router.post("/staff-attendance/bulk", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { date, records } = req.body;
      if (!date || !Array.isArray(records)) {
        res.status(400).json({ error: "date, records required" });
        return;
      }
      const markedBy = authUserId || null;

      const teacherIds = records.map((r: any) => r.teacherId);
      const validTeachers = await db
        .select({ id: teachersTable.id })
        .from(teachersTable)
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(and(eq(usersTable.schoolId, schoolId), inArray(teachersTable.id, teacherIds)));
      const validIds = new Set(validTeachers.map((t) => t.id));
      const filteredRecords = records.filter((r: any) => validIds.has(r.teacherId));
      if (filteredRecords.length === 0) {
        res.json([]);
        return;
      }

      const values = filteredRecords.map((r: any) => ({
        teacherId: r.teacherId,
        schoolId,
        date,
        status: r.status,
        markedBy,
      }));

      const result = await db
        .insert(staffAttendanceTable)
        .values(values)
        .onConflictDoUpdate({
          target: [staffAttendanceTable.teacherId, staffAttendanceTable.date],
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

export default router;
