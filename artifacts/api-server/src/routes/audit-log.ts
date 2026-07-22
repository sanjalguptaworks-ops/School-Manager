import { Router } from "express";
import { db, auditLogTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

// GET /audit-log — admin sees their own school's entries; creator sees
// every entry (optionally filtered by ?schoolId=). Entries are written
// internally by other routes -- there's no create/update/delete here.
router.get("/audit-log", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["admin", "creator"], req, res, async () => {
    try {
      const authUserId = (req as any).authUserId;
      const [me] = await db.select({ role: usersTable.role, schoolId: usersTable.schoolId }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

      const filters: any[] = [];
      if (me?.role === "admin") {
        if (!me.schoolId) { res.json([]); return; }
        filters.push(eq(auditLogTable.schoolId, me.schoolId));
      } else {
        const { schoolId } = req.query as Record<string, string>;
        if (schoolId) filters.push(eq(auditLogTable.schoolId, parseInt(schoolId)));
      }

      const rows = await db
        .select()
        .from(auditLogTable)
        .where(filters.length ? and(...filters) : undefined)
        .orderBy(desc(auditLogTable.createdAt))
        .limit(200);

      res.json(rows);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
