import { Router } from "express";
import { db, examsTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";
import { notifyNewExam } from "../lib/notify";

const router = Router();

async function getExamWithClass(id: number, schoolId: number) {
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
    .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
    .where(and(eq(examsTable.id, id), eq(classesTable.schoolId, schoolId)))
    .limit(1);
  return rows[0] || null;
}

// GET /exams
router.get("/exams", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const { classId } = req.query as { classId?: string };
    const filters = [eq(classesTable.schoolId, schoolId)];
    if (classId) filters.push(eq(examsTable.classId, parseInt(classId)));

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
      .innerJoin(classesTable, eq(examsTable.classId, classesTable.id))
      .where(and(...filters));
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /exams
router.post("/exams", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const { name, classId, subject, date, maxMarks } = req.body;
    if (!name || !classId || !subject || !date || !maxMarks) {
      return res.status(400).json({ error: "All fields required" });
    }

    const [cls] = await db
      .select({ id: classesTable.id })
      .from(classesTable)
      .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
      .limit(1);
    if (!cls) return res.status(400).json({ error: "Invalid classId" });

    const [exam] = await db
      .insert(examsTable)
      .values({ name, classId, subject, date, maxMarks })
      .returning();

    // Fire-and-forget: don't make the person wait for emails to send.
    notifyNewExam({ name: exam.name, subject: exam.subject, date: exam.date, maxMarks: exam.maxMarks, classId: exam.classId });

    const full = await getExamWithClass(exam.id, schoolId);
    return res.status(201).json(full);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /exams/:id
router.get("/exams/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const exam = await getExamWithClass(id, schoolId);
    if (!exam) return res.status(404).json({ error: "Not found" });
    return res.json(exam);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /exams/:id
router.patch("/exams/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const existing = await getExamWithClass(id, schoolId);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const { name, subject, date, maxMarks } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (subject) updates.subject = subject;
    if (date) updates.date = date;
    if (maxMarks) updates.maxMarks = maxMarks;
    await db.update(examsTable).set(updates).where(eq(examsTable.id, id));
    const exam = await getExamWithClass(id, schoolId);
    if (!exam) return res.status(404).json({ error: "Not found" });
    return res.json(exam);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /exams/:id
router.delete("/exams/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const existing = await getExamWithClass(id, schoolId);
    if (!existing) return res.status(404).json({ error: "Not found" });
    await db.delete(examsTable).where(eq(examsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
