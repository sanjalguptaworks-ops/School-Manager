import { Router } from "express";
import { db, noticesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { notifyNewNotice } from "../lib/notify";

const router = Router();

// GET /notices
router.get("/notices", requireAuth, async (req, res) => {
  try {
    const { classId, targetRole } = req.query as Record<string, string>;

    const rows = await db
      .select({
        id: noticesTable.id,
        title: noticesTable.title,
        body: noticesTable.body,
        targetRole: noticesTable.targetRole,
        classId: noticesTable.classId,
        createdBy: noticesTable.createdBy,
        createdAt: noticesTable.createdAt,
        createdByUser: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
      })
      .from(noticesTable)
      .leftJoin(usersTable, eq(noticesTable.createdBy, usersTable.id))
      .orderBy(noticesTable.createdAt);

    let filtered = rows;
    if (classId) filtered = filtered.filter((r) => r.classId === parseInt(classId));
    if (targetRole) filtered = filtered.filter((r) => r.targetRole === targetRole || r.targetRole === "all");

    return res.json(filtered.reverse());
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /notices
router.post("/notices", requireAuth, async (req, res) => {
  try {
    const { title, body, targetRole, classId } = req.body;
    if (!title || !body || !targetRole) {
      return res.status(400).json({ error: "title, body, targetRole required" });
    }
    const createdBy = (req as any).authUserId || null;

    const [notice] = await db
      .insert(noticesTable)
      .values({ title, body, targetRole, classId: classId || null, createdBy })
      .returning();

    // Fire-and-forget: don't make the person wait for emails to send.
    notifyNewNotice({ title: notice.title, body: notice.body, targetRole: notice.targetRole, classId: notice.classId });

    return res.status(201).json({ ...notice, createdByUser: null });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /notices/:id
router.delete("/notices/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    await db.delete(noticesTable).where(eq(noticesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
