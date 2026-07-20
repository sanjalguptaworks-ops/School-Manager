import { Router } from "express";
import { db, examsTable, classesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { notifyNewExam } from "../lib/notify";

const router = Router();

async function getExamWithClass(id: number) {
  const rows = await db
    .select({
      id: examsTable.id,
      name: examsTable.name,
      classId: examsTable.classId,
      subject: examsTable.subject,
      date: examsTable.date,
      maxMarks: examsTable.maxMarks,
      class: {
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
      },
    })
    .from(examsTable)
    .leftJoin(classesTable, eq(examsTable.classId, classesTable.id))
    .where(eq(examsTable.id, id))
    .limit(1);
  return rows[0] || null;
}

// GET /exams
router.get("/exams", requireAuth, async (req, res) => {
  try {
    const { classId } = req.query as { classId?: string };
    const base = db
      .select({
        id: examsTable.id,
        name: examsTable.name,
        classId: examsTable.classId,
        subject: examsTable.subject,
        date: examsTable.date,
        maxMarks: examsTable.maxMarks,
        class: {
          id: classesTable.id,
          name: classesTable.name,
          section: classesTable.section,
        },
      })
      .from(examsTable)
      .leftJoin(classesTable, eq(examsTable.classId, classesTable.id));

    const rows = classId
      ? await base.where(eq(examsTable.classId, parseInt(classId)))
      : await base;
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /exams
router.post("/exams", requireAuth, async (req, res) => {
  try {
    const { name, classId, subject, date, maxMarks } = req.body;
    if (!name || !classId || !subject || !date || !maxMarks) {
      return res.status(400).json({ error: "All fields required" });
    }
    const [exam] = await db
      .insert(examsTable)
      .values({ name, classId, subject, date, maxMarks })
      .returning();

    // Fire-and-forget: don't make the person wait for emails to send.
    notifyNewExam({ name: exam.name, subject: exam.subject, date: exam.date, maxMarks: exam.maxMarks, classId: exam.classId });

    const full = await getExamWithClass(exam.id);
    return res.status(201).json(full);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /exams/:id
router.get("/exams/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const exam = await getExamWithClass(id);
    if (!exam) return res.status(404).json({ error: "Not found" });
    return res.json(exam);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /exams/:id
router.patch("/exams/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { name, subject, date, maxMarks } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (subject) updates.subject = subject;
    if (date) updates.date = date;
    if (maxMarks) updates.maxMarks = maxMarks;
    await db.update(examsTable).set(updates).where(eq(examsTable.id, id));
    const exam = await getExamWithClass(id);
    if (!exam) return res.status(404).json({ error: "Not found" });
    return res.json(exam);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /exams/:id
router.delete("/exams/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    await db.delete(examsTable).where(eq(examsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
