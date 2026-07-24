import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";

const router = Router();

// POST /push-subscriptions — any authenticated user, called right after the
// browser's PushManager.subscribe() resolves. Upserts on endpoint so
// re-subscribing the same browser (e.g. after clearing site data) doesn't
// pile up duplicate rows.
router.post("/push-subscriptions", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { endpoint, p256dhKey, authKey } = req.body;
    if (!endpoint || !p256dhKey || !authKey) {
      res.status(400).json({ error: "endpoint, p256dhKey, authKey required" });
      return;
    }

    await db
      .insert(pushSubscriptionsTable)
      .values({ userId: authUserId, schoolId, endpoint, p256dhKey, authKey })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: { userId: authUserId, schoolId, p256dhKey, authKey },
      });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /push-subscriptions — called when the user disables notifications
// in-app, or the service worker's pushsubscriptionchange fires with no
// replacement. Only ever deletes the caller's own subscription.
router.delete("/push-subscriptions", requireAuth, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: "endpoint required" });
      return;
    }
    await db.delete(pushSubscriptionsTable).where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, authUserId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
