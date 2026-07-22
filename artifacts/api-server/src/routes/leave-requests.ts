import { Router } from "express";
import { db, leaveRequestsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

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

export default router;
