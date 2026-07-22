import { Router } from "express";
import { db, classesTable, studentsTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

const router = Router();

// GET /classes — a teacher assigned to specific classes only sees those;
// everyone else (admin, or a teacher not yet assigned to any class) sees
// every class in the school, same as before this restriction existed.
router.get("/classes", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const scope = await getTeacherClassScope(authUserId);
    if (scope.kind === "restricted" && scope.classIds.length === 0) {
      return res.json([]);
    }

    const filters = [eq(classesTable.schoolId, schoolId)];
    if (scope.kind === "restricted") filters.push(inArray(classesTable.id, scope.classIds));

    const rows = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
        studentCount: sql<number>`count(${studentsTable.id})::int`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .where(and(...filters))
      .groupBy(classesTable.id);
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /classes — admin only
router.post("/classes", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const { name, section } = req.body;
      if (!name || !section) {
        res.status(400).json({ error: "name and section required" });
        return;
      }
      const schoolId = (req as any).schoolId;
      const [cls] = await db.insert(classesTable).values({ name, section, schoolId }).returning();
      res.status(201).json({ ...cls, studentCount: 0 });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /classes/:id
router.get("/classes/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const scope = await getTeacherClassScope(authUserId);
    if (!canAccessClass(scope, id)) return res.status(403).json({ error: "Forbidden" });
    const rows = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
        studentCount: sql<number>`count(${studentsTable.id})::int`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .where(and(eq(classesTable.id, id), eq(classesTable.schoolId, schoolId)))
      .groupBy(classesTable.id);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /classes/:id — admin only
router.patch("/classes/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const { name, section } = req.body;
      const updates: Record<string, any> = {};
      if (name) updates.name = name;
      if (section) updates.section = section;
      const [updated] = await db
        .update(classesTable)
        .set(updates)
        .where(and(eq(classesTable.id, id), eq(classesTable.schoolId, schoolId)))
        .returning();
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ ...updated, studentCount: 0 });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /classes/:id — admin only
router.delete("/classes/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const [deleted] = await db
        .delete(classesTable)
        .where(and(eq(classesTable.id, id), eq(classesTable.schoolId, schoolId)))
        .returning();
      if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /classes/:id/promote-students — admin only. Bulk-moves every student
// currently in this class into targetClassId (e.g. year-end promotion),
// instead of editing each student one at a time.
router.post("/classes/:id/promote-students", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const sourceClassId = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const { targetClassId } = req.body;

      if (!targetClassId) {
        res.status(400).json({ error: "targetClassId is required" });
        return;
      }
      if (targetClassId === sourceClassId) {
        res.status(400).json({ error: "targetClassId must be different from the source class" });
        return;
      }

      const [source] = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.id, sourceClassId), eq(classesTable.schoolId, schoolId))).limit(1);
      if (!source) { res.status(404).json({ error: "Source class not found" }); return; }

      const [target] = await db.select({ id: classesTable.id }).from(classesTable).where(and(eq(classesTable.id, targetClassId), eq(classesTable.schoolId, schoolId))).limit(1);
      if (!target) { res.status(400).json({ error: "Invalid targetClassId" }); return; }

      const moved = await db
        .update(studentsTable)
        .set({ classId: targetClassId })
        .where(eq(studentsTable.classId, sourceClassId))
        .returning({ id: studentsTable.id });

      res.json({ promoted: moved.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
