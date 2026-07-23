import { Router } from "express";
import { db, customPagesTable, customPageAttachmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

// GET /custom-pages — any authenticated user in the school (Food Menu,
// Holiday List, Family Letter etc. aren't role- or class-restricted).
router.get("/custom-pages", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const rows = await db
      .select()
      .from(customPagesTable)
      .where(eq(customPagesTable.schoolId, schoolId))
      .orderBy(customPagesTable.title);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /custom-pages — admin only
router.post("/custom-pages", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { title, body } = req.body;
      if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: "title and body are required" });
        return;
      }
      const [page] = await db
        .insert(customPagesTable)
        .values({ title, body, schoolId, createdBy: authUserId || null })
        .returning();
      res.status(201).json({ ...page, attachments: [] });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /custom-pages/:id
router.get("/custom-pages/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const id = parseInt(req.params["id"] as string);

    const [page] = await db
      .select()
      .from(customPagesTable)
      .where(and(eq(customPagesTable.id, id), eq(customPagesTable.schoolId, schoolId)))
      .limit(1);
    if (!page) { res.status(404).json({ error: "Not found" }); return; }

    const attachments = await db
      .select()
      .from(customPageAttachmentsTable)
      .where(eq(customPageAttachmentsTable.pageId, id))
      .orderBy(customPageAttachmentsTable.createdAt);

    res.json({ ...page, attachments });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /custom-pages/:id — admin only
router.patch("/custom-pages/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params["id"] as string);
      const { title, body } = req.body;
      if (!title?.trim() || !body?.trim()) {
        res.status(400).json({ error: "title and body are required" });
        return;
      }

      const [updated] = await db
        .update(customPagesTable)
        .set({ title, body, updatedAt: new Date() })
        .where(and(eq(customPagesTable.id, id), eq(customPagesTable.schoolId, schoolId)))
        .returning();
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }

      const attachments = await db
        .select()
        .from(customPageAttachmentsTable)
        .where(eq(customPageAttachmentsTable.pageId, id))
        .orderBy(customPageAttachmentsTable.createdAt);

      res.json({ ...updated, attachments });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /custom-pages/:id — admin only
router.delete("/custom-pages/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params["id"] as string);
      const [deleted] = await db
        .delete(customPagesTable)
        .where(and(eq(customPagesTable.id, id), eq(customPagesTable.schoolId, schoolId)))
        .returning();
      if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /custom-pages/:id/attachments — admin only
router.post("/custom-pages/:id/attachments", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params["id"] as string);
      const { fileUrl, fileName } = req.body;
      if (!fileUrl?.trim() || !fileName?.trim()) {
        res.status(400).json({ error: "fileUrl and fileName are required" });
        return;
      }

      const [page] = await db
        .select({ id: customPagesTable.id })
        .from(customPagesTable)
        .where(and(eq(customPagesTable.id, id), eq(customPagesTable.schoolId, schoolId)))
        .limit(1);
      if (!page) { res.status(404).json({ error: "Not found" }); return; }

      const [attachment] = await db
        .insert(customPageAttachmentsTable)
        .values({ pageId: id, fileUrl, fileName })
        .returning();
      res.status(201).json(attachment);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /custom-pages/:id/attachments/:attachmentId — admin only
router.delete("/custom-pages/:id/attachments/:attachmentId", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params["id"] as string);
      const attachmentId = parseInt(req.params["attachmentId"] as string);

      const [page] = await db
        .select({ id: customPagesTable.id })
        .from(customPagesTable)
        .where(and(eq(customPagesTable.id, id), eq(customPagesTable.schoolId, schoolId)))
        .limit(1);
      if (!page) { res.status(404).json({ error: "Not found" }); return; }

      const [deleted] = await db
        .delete(customPageAttachmentsTable)
        .where(and(eq(customPageAttachmentsTable.id, attachmentId), eq(customPageAttachmentsTable.pageId, id)))
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
