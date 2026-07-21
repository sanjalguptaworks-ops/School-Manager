import { Router } from "express";
import { db, eventsTable, classesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

// GET /events — everyone in the school (like notices, events are broadly
// visible). Optional ?month=YYYY-MM and ?classId= filters.
router.get("/events", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const { month, classId } = req.query as Record<string, string>;

    const filters = [eq(eventsTable.schoolId, schoolId)];
    if (month) filters.push(sql`to_char(${eventsTable.date}::date, 'YYYY-MM') = ${month}`);
    if (classId) filters.push(eq(eventsTable.classId, parseInt(classId)));

    const rows = await db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        description: eventsTable.description,
        date: eventsTable.date,
        classId: eventsTable.classId,
        createdBy: eventsTable.createdBy,
        createdAt: eventsTable.createdAt,
        class: { id: classesTable.id, name: classesTable.name, section: classesTable.section },
      })
      .from(eventsTable)
      .leftJoin(classesTable, eq(eventsTable.classId, classesTable.id))
      .where(and(...filters))
      .orderBy(eventsTable.date);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /events — admin or teacher
router.post("/events", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { title, description, date, classId } = req.body;
      if (!title?.trim() || !date) {
        res.status(400).json({ error: "title and date are required" });
        return;
      }

      if (classId) {
        const [cls] = await db
          .select({ id: classesTable.id })
          .from(classesTable)
          .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
          .limit(1);
        if (!cls) {
          res.status(400).json({ error: "Invalid classId" });
          return;
        }
      }

      const [event] = await db
        .insert(eventsTable)
        .values({
          title: title.trim(),
          description: description?.trim() || null,
          date,
          classId: classId || null,
          schoolId,
          createdBy: authUserId,
        })
        .returning();

      res.status(201).json(event);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /events/:id — admin only
router.delete("/events/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [deleted] = await db
        .delete(eventsTable)
        .where(and(eq(eventsTable.id, id), eq(eventsTable.schoolId, schoolId)))
        .returning();
      if (!deleted) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
