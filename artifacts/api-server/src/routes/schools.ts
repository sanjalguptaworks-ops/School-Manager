import { Router } from "express";
import { db, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

const DEFAULT_TRIAL_DAYS = 30;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0] as string;
}

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

// POST /schools/:id/approve — creator only. Starts the free trial: sets
// trialStartedAt to now and computes the initial paidUntil from trialDays
// (defaulting to 14 if the creator hasn't set one yet).
router.post("/schools/:id/approve", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const [existing] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const trialDays = existing.trialDays ?? DEFAULT_TRIAL_DAYS;
      const trialStartedAt = new Date();
      const paidUntil = toDateString(addDays(trialStartedAt, trialDays));

      const [school] = await db
        .update(schoolsTable)
        .set({ status: "approved", trialDays, trialStartedAt, paidUntil })
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
      const [existing] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const {
        name,
        contactEmail,
        contactPhone,
        address,
        logoUrl,
        emailEnabled,
        smsEnabled,
        suspendedFrom,
        suspendedUntil,
        discountPercent,
        trialDays,
        billingInterval,
      } = req.body;

      const updates: Record<string, any> = {};
      if (typeof name === "string" && name.trim()) updates.name = name.trim();
      if (typeof contactEmail === "string") updates.contactEmail = contactEmail.trim() || null;
      if (typeof contactPhone === "string") updates.contactPhone = contactPhone.trim() || null;
      if (typeof address === "string") updates.address = address.trim() || null;
      if (logoUrl === null || typeof logoUrl === "string") updates.logoUrl = logoUrl;
      if (typeof emailEnabled === "boolean") updates.emailEnabled = emailEnabled;
      if (typeof smsEnabled === "boolean") updates.smsEnabled = smsEnabled;
      if (typeof discountPercent === "number") updates.discountPercent = Math.max(0, Math.min(100, Math.round(discountPercent)));
      if (trialDays === null || typeof trialDays === "number") {
        updates.trialDays = trialDays;
        // Only re-anchor paidUntil off the new trial length while the
        // school is still actually in its trial (never once they've moved
        // to manual/auto billing, where paidUntil means something else).
        if (existing.billingMode === "trial" && existing.trialStartedAt && typeof trialDays === "number") {
          updates.paidUntil = toDateString(addDays(new Date(existing.trialStartedAt), trialDays));
        }
      }
      if (billingInterval === "monthly" || billingInterval === "annual") updates.billingInterval = billingInterval;
      // Both are nullable dates; explicit null clears a scheduled suspension.
      // suspendedFrom is what actually flips "is suspended", so it also
      // drives suspensionReason -- this is the creator's manual lever, kept
      // separate from any suspension the billing webhook causes.
      if (suspendedFrom === null || typeof suspendedFrom === "string") {
        updates.suspendedFrom = suspendedFrom;
        updates.suspensionReason = suspendedFrom === null ? null : "manual";
      }
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
