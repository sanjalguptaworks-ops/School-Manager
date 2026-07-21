import { Router } from "express";
import { db, examsTable, classesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { notifyNewExam } from "../lib/notify";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

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
    const authUserId = (req as any).authUserId;
    const { classId } = req.query as { classId?: string };

    const scope = await getTeacherClassScope(authUserId);
    if (classId && !canAccessClass(scope, parseInt(classId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (scope.kind === "restricted" && scope.classIds.length === 0) {
      return res.json([]);
    }

    const filters = [eq(classesTable.schoolId, schoolId)];
    if (classId) filters.push(eq(examsTable.classId, parseInt(classId)));
    else if (scope.kind === "restricted") filters.push(inArray(examsTable.classId, scope.classIds));

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

// POST /exams — admin or teacher
router.post("/exams", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { name, classId, subject, date, maxMarks } = req.body;
      if (!name || !classId || !subject || !date || !maxMarks) {
        res.status(400).json({ error: "All fields required" });
        return;
      }

      const scope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(scope, classId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }

      const [exam] = await db
        .insert(examsTable)
        .values({ name, classId, subject, date, maxMarks })
        .returning();

      // Fire-and-forget: don't make the person wait for emails to send.
      notifyNewExam({ name: exam.name, subject: exam.subject, date: exam.date, maxMarks: exam.maxMarks, classId: exam.classId }, schoolId);

      const full = await getExamWithClass(exam.id, schoolId);
      res.status(201).json(full);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /exams/:id
router.get("/exams/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const exam = await getExamWithClass(id, schoolId);
    if (!exam) return res.status(404).json({ error: "Not found" });
    const scope = await getTeacherClassScope(authUserId);
    if (!canAccessClass(scope, exam.classId)) return res.status(403).json({ error: "Forbidden" });
    return res.json(exam);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /exams/:id — admin or teacher
router.patch("/exams/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const existing = await getExamWithClass(id, schoolId);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const scope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(scope, existing.classId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const { name, subject, date, maxMarks } = req.body;
      const updates: Record<string, any> = {};
      if (name) updates.name = name;
      if (subject) updates.subject = subject;
      if (date) updates.date = date;
      if (maxMarks) updates.maxMarks = maxMarks;
      await db.update(examsTable).set(updates).where(eq(examsTable.id, id));
      const exam = await getExamWithClass(id, schoolId);
      if (!exam) { res.status(404).json({ error: "Not found" }); return; }
      res.json(exam);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /exams/:id — admin or teacher
router.delete("/exams/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const existing = await getExamWithClass(id, schoolId);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const scope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(scope, existing.classId)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      await db.delete(examsTable).where(eq(examsTable.id, id));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
