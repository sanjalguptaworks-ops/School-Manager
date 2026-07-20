import { Router } from "express";
import { db, noticesTable, usersTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";
import { notifyNewNotice } from "../lib/notify";

const router = Router();

// GET /notices
router.get("/notices", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
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
      .where(eq(noticesTable.schoolId, schoolId))
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
router.post("/notices", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const { title, body, targetRole, classId } = req.body;
    if (!title || !body || !targetRole) {
      return res.status(400).json({ error: "title, body, targetRole required" });
    }
    const createdBy = (req as any).authUserId || null;

    if (classId) {
      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) return res.status(400).json({ error: "Invalid classId" });
    }

    const [notice] = await db
      .insert(noticesTable)
      .values({ title, body, targetRole, classId: classId || null, schoolId, createdBy })
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
router.delete("/notices/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const [deleted] = await db
      .delete(noticesTable)
      .where(and(eq(noticesTable.id, id), eq(noticesTable.schoolId, schoolId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
