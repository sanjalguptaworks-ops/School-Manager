import { Router } from "express";
import { db, lessonPlansTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

const router = Router();

// GET /lesson-plans — staff only (teacher/admin); never shown to
// students/parents, unlike homework/resources.
router.get("/lesson-plans", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { classId } = req.query as Record<string, string>;

      const filters: any[] = [eq(lessonPlansTable.schoolId, schoolId)];

      const classScope = await getTeacherClassScope(authUserId);
      if (classId && !canAccessClass(classScope, parseInt(classId))) { res.status(403).json({ error: "Forbidden" }); return; }
      if (classId) filters.push(eq(lessonPlansTable.classId, parseInt(classId)));
      else if (classScope.kind === "restricted") {
        if (classScope.classIds.length === 0) { res.json([]); return; }
        filters.push(eq(lessonPlansTable.classId, classScope.classIds[0]!));
      }

      const rows = await db
        .select()
        .from(lessonPlansTable)
        .where(and(...filters))
        .orderBy(desc(lessonPlansTable.planDate))
        .limit(50);

      res.json(rows);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /lesson-plans — admin or teacher
router.post("/lesson-plans", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { classId, subject, planDate, topic, content } = req.body;
      if (!classId || !subject?.trim() || !planDate || !topic?.trim() || !content?.trim()) {
        res.status(400).json({ error: "classId, subject, planDate, topic and content are required" });
        return;
      }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [plan] = await db
        .insert(lessonPlansTable)
        .values({ classId, subject: subject.trim(), planDate, topic: topic.trim(), content: content.trim(), schoolId, createdBy: authUserId || null })
        .returning();

      res.status(201).json(plan);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /lesson-plans/:id — admin or teacher
router.delete("/lesson-plans/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [deleted] = await db
        .delete(lessonPlansTable)
        .where(and(eq(lessonPlansTable.id, id), eq(lessonPlansTable.schoolId, schoolId)))
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
