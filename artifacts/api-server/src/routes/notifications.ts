import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";

const router = Router();

// GET /notifications — the logged-in user's own feed, newest first.
router.get("/notifications", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const { unreadOnly } = req.query as Record<string, string>;

    const filters = [eq(notificationsTable.userId, authUserId)];
    if (unreadOnly === "true") filters.push(eq(notificationsTable.read, false));

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(and(...filters))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /notifications/unread-count — for the bell-icon badge, without
// pulling the full list.
router.get("/notifications/unread-count", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, authUserId), eq(notificationsTable.read, false)));
    res.json({ count: row?.count ?? 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /notifications/unread-by-category — for a grouped "Updates" screen
// (Circulars, Resources, Galleries, etc.), derived from each notification's
// link prefix rather than a separate category column.
router.get("/notifications/unread-by-category", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const rows = await db
      .select({
        category: sql<string>`
          case
            when ${notificationsTable.link} like '/notices%' then 'Circulars'
            when ${notificationsTable.link} like '/resources%' then 'Resources'
            when ${notificationsTable.link} like '/gallery%' then 'Galleries'
            when ${notificationsTable.link} like '/polls%' then 'Polls'
            when ${notificationsTable.link} like '/appointments%' then 'Appointments'
            when ${notificationsTable.link} like '/leave-requests%' then 'Leave Requests'
            when ${notificationsTable.link} like '/fees%' then 'Fees'
            when ${notificationsTable.link} like '/exams%' then 'Exams'
            when ${notificationsTable.link} like '/messages%' then 'Messages'
            when ${notificationsTable.link} like '/events%' then 'Events'
            else 'Other'
          end
        `,
        count: sql<number>`count(*)::int`,
      })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, authUserId), eq(notificationsTable.read, false)))
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /notifications/:id/read — mark one's own notification read
router.patch("/notifications/:id/read", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const authUserId = (req as any).authUserId;

    const [updated] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, authUserId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /notifications/mark-all-read
router.post("/notifications/mark-all-read", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.userId, authUserId), eq(notificationsTable.read, false)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
