import { Router } from "express";
import { db, admissionInquiriesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

const STATUSES = ["new", "contacted", "admitted", "rejected"];

// GET /admission-inquiries — admin only, optional ?status= filter
router.get("/admission-inquiries", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { status } = req.query as Record<string, string>;

      const filters: any[] = [eq(admissionInquiriesTable.schoolId, schoolId)];
      if (status) filters.push(eq(admissionInquiriesTable.status, status as any));

      const rows = await db
        .select()
        .from(admissionInquiriesTable)
        .where(and(...filters))
        .orderBy(desc(admissionInquiriesTable.createdAt));

      res.json(rows);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /admission-inquiries — admin only, logs a new inquiry
router.post("/admission-inquiries", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { name, email, phone, desiredClass, message } = req.body;

      if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

      const [inquiry] = await db
        .insert(admissionInquiriesTable)
        .values({
          name: name.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          desiredClass: desiredClass?.trim() || null,
          message: message?.trim() || null,
          schoolId,
        })
        .returning();

      res.status(201).json(inquiry);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// PATCH /admission-inquiries/:id — admin only, e.g. update status
router.patch("/admission-inquiries/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const { status } = req.body || {};

      if (status && !STATUSES.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${STATUSES.join(", ")}` });
        return;
      }

      const updates: Record<string, any> = {};
      if (status) updates.status = status;
      if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

      const [updated] = await db
        .update(admissionInquiriesTable)
        .set(updates)
        .where(and(eq(admissionInquiriesTable.id, id), eq(admissionInquiriesTable.schoolId, schoolId)))
        .returning();
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /admission-inquiries/:id — admin only
router.delete("/admission-inquiries/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;

      const [deleted] = await db
        .delete(admissionInquiriesTable)
        .where(and(eq(admissionInquiriesTable.id, id), eq(admissionInquiriesTable.schoolId, schoolId)))
        .returning();
      if (!deleted) { res.status(404).json({ error: "Not found" }); return; }

      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
