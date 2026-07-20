import { Router } from "express";
import { db, classesTable, studentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

// GET /classes
router.get("/classes", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const rows = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
        studentCount: sql<number>`count(${studentsTable.id})::int`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .where(eq(classesTable.schoolId, schoolId))
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

export default router;
