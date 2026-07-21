import { Router } from "express";
import { db, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// GET /schools — creator only. Optional ?status=pending|approved|rejected
router.get("/schools", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const { status } = req.query as { status?: string };
      const rows = status
        ? await db.select().from(schoolsTable).where(eq(schoolsTable.status, status as any))
        : await db.select().from(schoolsTable);
      res.json(rows);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /schools/:id/approve — creator only
router.post("/schools/:id/approve", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const [school] = await db
        .update(schoolsTable)
        .set({ status: "approved" })
        .where(eq(schoolsTable.id, id))
        .returning();
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(school);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /schools/:id/reject — creator only
router.post("/schools/:id/reject", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const [school] = await db
        .update(schoolsTable)
        .set({ status: "rejected" })
        .where(eq(schoolsTable.id, id))
        .returning();
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(school);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /schools/:id — creator only
router.get("/schools/:id", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, id)).limit(1);
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(school);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// PATCH /schools/:id — creator only. Full profile edit: contact info,
// email/SMS toggles, and the scheduled suspension window.
router.patch("/schools/:id", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const {
        name,
        contactEmail,
        contactPhone,
        address,
        emailEnabled,
        smsEnabled,
        suspendedFrom,
        suspendedUntil,
      } = req.body;

      const updates: Record<string, any> = {};
      if (typeof name === "string" && name.trim()) updates.name = name.trim();
      if (typeof contactEmail === "string") updates.contactEmail = contactEmail.trim() || null;
      if (typeof contactPhone === "string") updates.contactPhone = contactPhone.trim() || null;
      if (typeof address === "string") updates.address = address.trim() || null;
      if (typeof emailEnabled === "boolean") updates.emailEnabled = emailEnabled;
      if (typeof smsEnabled === "boolean") updates.smsEnabled = smsEnabled;
      // Both are nullable dates; explicit null clears a scheduled suspension.
      if (suspendedFrom === null || typeof suspendedFrom === "string") updates.suspendedFrom = suspendedFrom;
      if (suspendedUntil === null || typeof suspendedUntil === "string") updates.suspendedUntil = suspendedUntil;

      const [school] = await db
        .update(schoolsTable)
        .set(updates)
        .where(eq(schoolsTable.id, id))
        .returning();
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(school);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
