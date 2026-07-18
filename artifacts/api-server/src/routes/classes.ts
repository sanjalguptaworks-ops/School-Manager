import { Router } from "express";
import { db, classesTable, studentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /classes
router.get("/classes", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
        studentCount: sql<number>`count(${studentsTable.id})::int`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .groupBy(classesTable.id);
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /classes
router.post("/classes", requireAuth, async (req, res) => {
  try {
    const { name, section } = req.body;
    if (!name || !section) {
      return res.status(400).json({ error: "name and section required" });
    }
    const [cls] = await db.insert(classesTable).values({ name, section }).returning();
    return res.status(201).json({ ...cls, studentCount: 0 });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /classes/:id
router.get("/classes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const rows = await db
      .select({
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
        studentCount: sql<number>`count(${studentsTable.id})::int`,
      })
      .from(classesTable)
      .leftJoin(studentsTable, eq(studentsTable.classId, classesTable.id))
      .where(eq(classesTable.id, id))
      .groupBy(classesTable.id);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    return res.json(rows[0]);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /classes/:id
router.patch("/classes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { name, section } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (section) updates.section = section;
    const [updated] = await db
      .update(classesTable)
      .set(updates)
      .where(eq(classesTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json({ ...updated, studentCount: 0 });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /classes/:id
router.delete("/classes/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    await db.delete(classesTable).where(eq(classesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
