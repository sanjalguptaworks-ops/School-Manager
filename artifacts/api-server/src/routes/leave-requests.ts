import { Router } from "express";
import { db, leaveRequestsTable, usersTable, teachersTable, timetableSlotsTable, classesTable, WEEKDAYS } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { notifyLeaveRequestReviewed } from "../lib/notify";

const router = Router();

type Weekday = (typeof WEEKDAYS)[number];
const FULL_WEEK = ["sunday", ...WEEKDAYS] as const;

// Every distinct weekday (school-week only, i.e. never "sunday") that falls
// within [startDate, endDate] inclusive. Caps the scan once all 6 possible
// weekdays are found, so a long leave range doesn't loop unnecessarily.
function weekdaysInRange(startDate: string, endDate: string): Weekday[] {
  const found = new Set<Weekday>();
  const cur = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cur <= end && found.size < WEEKDAYS.length) {
    const dayName = FULL_WEEK[cur.getUTCDay()];
    if (dayName !== "sunday") found.add(dayName as Weekday);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return Array.from(found);
}

function selectFields() {
  return {
    id: leaveRequestsTable.id,
    requestedBy: leaveRequestsTable.requestedBy,
    startDate: leaveRequestsTable.startDate,
    endDate: leaveRequestsTable.endDate,
    reason: leaveRequestsTable.reason,
    status: leaveRequestsTable.status,
    reviewedBy: leaveRequestsTable.reviewedBy,
    reviewedAt: leaveRequestsTable.reviewedAt,
    createdAt: leaveRequestsTable.createdAt,
  };
}

// GET /leave-requests — admin sees every request in the school (optionally
// filtered by ?status=); teacher/student see only their own.
router.get("/leave-requests", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { status } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

    const filters: any[] = [eq(leaveRequestsTable.schoolId, schoolId)];
    if (user?.role !== "admin") filters.push(eq(leaveRequestsTable.requestedBy, authUserId));
    if (status) filters.push(eq(leaveRequestsTable.status, status as any));

    const rows = await db
      .select({
        ...selectFields(),
        requester: { id: usersTable.id, name: usersTable.name, role: usersTable.role },
      })
      .from(leaveRequestsTable)
      .innerJoin(usersTable, eq(leaveRequestsTable.requestedBy, usersTable.id))
      .where(and(...filters))
      .orderBy(desc(leaveRequestsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /leave-requests — teacher or student, for themselves
router.post("/leave-requests", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["teacher", "student"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { startDate, endDate, reason } = req.body;

      if (!startDate || !endDate || !reason?.trim()) {
        res.status(400).json({ error: "startDate, endDate and reason are required" });
        return;
      }
      if (endDate < startDate) {
        res.status(400).json({ error: "endDate must be on or after startDate" });
        return;
      }

      const [leaveRequest] = await db
        .insert(leaveRequestsTable)
        .values({ requestedBy: authUserId, schoolId, startDate, endDate, reason: reason.trim() })
        .returning();

      res.status(201).json(leaveRequest);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// PATCH /leave-requests/:id — admin only, approve or reject
router.patch("/leave-requests/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { status } = req.body;

      if (status !== "approved" && status !== "rejected") {
        res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
        return;
      }

      const [existing] = await db
        .select({ id: leaveRequestsTable.id, status: leaveRequestsTable.status })
        .from(leaveRequestsTable)
        .where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      if (existing.status !== "pending") { res.status(400).json({ error: "This request has already been reviewed" }); return; }

      const [updated] = await db
        .update(leaveRequestsTable)
        .set({ status, reviewedBy: authUserId, reviewedAt: new Date() })
        .where(eq(leaveRequestsTable.id, id))
        .returning();

      if (updated) {
        notifyLeaveRequestReviewed(
          { requestedBy: updated.requestedBy, status: updated.status as "approved" | "rejected", startDate: updated.startDate, endDate: updated.endDate },
          schoolId,
        );
      }

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /leave-requests/:id — the requester can cancel their own pending
// request; admin can remove any.
router.delete("/leave-requests/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

    const [existing] = await db
      .select({ id: leaveRequestsTable.id, requestedBy: leaveRequestsTable.requestedBy, status: leaveRequestsTable.status })
      .from(leaveRequestsTable)
      .where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.schoolId, schoolId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const isOwner = existing.requestedBy === authUserId;
    if (user?.role !== "admin" && !(isOwner && existing.status === "pending")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /leave-requests/:id/substitute-suggestions — admin only. For a leave
// request from a teacher, shows which of the teacher's timetable periods
// fall within the leave's date range and which other teachers are free
// (have no class of their own) at that same day+period.
router.get("/leave-requests/:id/substitute-suggestions", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;

      const [leaveRequest] = await db
        .select({ requestedBy: leaveRequestsTable.requestedBy, startDate: leaveRequestsTable.startDate, endDate: leaveRequestsTable.endDate })
        .from(leaveRequestsTable)
        .where(and(eq(leaveRequestsTable.id, id), eq(leaveRequestsTable.schoolId, schoolId)))
        .limit(1);
      if (!leaveRequest) { res.status(404).json({ error: "Not found" }); return; }

      const [onLeaveTeacher] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, leaveRequest.requestedBy)).limit(1);
      if (!onLeaveTeacher) {
        // Not a teacher (e.g. a student's leave request) -- nothing to substitute.
        res.json([]);
        return;
      }

      const weekdays = weekdaysInRange(leaveRequest.startDate, leaveRequest.endDate);
      if (weekdays.length === 0) { res.json([]); return; }

      const affectedSlots = await db
        .select({
          dayOfWeek: timetableSlotsTable.dayOfWeek,
          periodNumber: timetableSlotsTable.periodNumber,
          subject: timetableSlotsTable.subject,
          className: classesTable.name,
          section: classesTable.section,
        })
        .from(timetableSlotsTable)
        .innerJoin(classesTable, eq(timetableSlotsTable.classId, classesTable.id))
        .where(and(eq(timetableSlotsTable.teacherId, onLeaveTeacher.id), inArray(timetableSlotsTable.dayOfWeek, weekdays)));

      if (affectedSlots.length === 0) { res.json([]); return; }

      // Every slot in the school for these weekdays, to know who's already
      // teaching at a given (day, period).
      const allSlots = await db
        .select({ dayOfWeek: timetableSlotsTable.dayOfWeek, periodNumber: timetableSlotsTable.periodNumber, teacherId: timetableSlotsTable.teacherId })
        .from(timetableSlotsTable)
        .innerJoin(classesTable, eq(timetableSlotsTable.classId, classesTable.id))
        .where(and(eq(classesTable.schoolId, schoolId), inArray(timetableSlotsTable.dayOfWeek, weekdays)));

      const busyByDayPeriod = new Map<string, Set<number>>();
      for (const s of allSlots) {
        if (!s.teacherId) continue;
        const key = `${s.dayOfWeek}-${s.periodNumber}`;
        if (!busyByDayPeriod.has(key)) busyByDayPeriod.set(key, new Set());
        busyByDayPeriod.get(key)!.add(s.teacherId);
      }

      const allTeachers = await db
        .select({ id: teachersTable.id, name: usersTable.name })
        .from(teachersTable)
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(eq(usersTable.schoolId, schoolId));

      const result = affectedSlots.map((slot) => {
        const key = `${slot.dayOfWeek}-${slot.periodNumber}`;
        const busy = busyByDayPeriod.get(key) ?? new Set();
        const freeTeachers = allTeachers.filter((t) => t.id !== onLeaveTeacher.id && !busy.has(t.id));
        return {
          dayOfWeek: slot.dayOfWeek,
          periodNumber: slot.periodNumber,
          subject: slot.subject,
          class: `${slot.className} ${slot.section}`,
          freeTeachers,
        };
      });

      res.json(result);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
