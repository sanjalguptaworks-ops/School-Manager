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

export default router;
