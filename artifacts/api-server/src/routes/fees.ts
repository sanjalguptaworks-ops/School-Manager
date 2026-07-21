import { Router } from "express";
import { db, feeStructuresTable, feePaymentsTable, classesTable, studentsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { notifyFeeDue } from "../lib/notify";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";

const router = Router();

// GET /fee-structures
router.get("/fee-structures", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const { classId } = req.query as { classId?: string };
    const filters = [eq(classesTable.schoolId, schoolId)];
    if (classId) filters.push(eq(feeStructuresTable.classId, parseInt(classId)));

    const rows = await db
      .select({
        id: feeStructuresTable.id,
        classId: feeStructuresTable.classId,
        amount: feeStructuresTable.amount,
        dueDate: feeStructuresTable.dueDate,
        term: feeStructuresTable.term,
        class: {
          id: classesTable.id,
          name: classesTable.name,
          section: classesTable.section,
        },
      })
      .from(feeStructuresTable)
      .innerJoin(classesTable, eq(feeStructuresTable.classId, classesTable.id))
      .where(and(...filters));
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /fee-structures — admin only
router.post("/fee-structures", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { classId, amount, dueDate, term } = req.body;
      if (!classId || !amount || !dueDate || !term) {
        res.status(400).json({ error: "All fields required" });
        return;
      }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }

      const [fs] = await db
        .insert(feeStructuresTable)
        .values({ classId, amount: String(amount), dueDate, term })
        .returning();
      res.status(201).json({ ...fs, class: null });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /fee-payments
router.get("/fee-payments", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { studentId, classId, status } = req.query as Record<string, string>;

    const scope = await getStudentAccessScope(authUserId);
    if (studentId && !canAccessStudent(scope, parseInt(studentId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (scope.kind === "restricted" && scope.studentIds.length === 0) {
      return res.json([]);
    }

    const filters: any[] = [eq(classesTable.schoolId, schoolId)];
    if (studentId) filters.push(eq(feePaymentsTable.studentId, parseInt(studentId)));
    else if (scope.kind === "restricted") filters.push(inArray(feePaymentsTable.studentId, scope.studentIds));
    if (classId) filters.push(eq(studentsTable.classId, parseInt(classId)));
    if (status) filters.push(eq(feePaymentsTable.status, status as any));

    const rows = await db
      .select({
        id: feePaymentsTable.id,
        studentId: feePaymentsTable.studentId,
        feeStructureId: feePaymentsTable.feeStructureId,
        status: feePaymentsTable.status,
        paidOn: feePaymentsTable.paidOn,
        student: sql<any>`json_build_object('id', ${studentsTable.id}, 'rollNo', ${studentsTable.rollNo}, 'user', json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}, 'avatarUrl', ${usersTable.avatarUrl}))`,
        feeStructure: sql<any>`json_build_object('id', ${feeStructuresTable.id}, 'amount', ${feeStructuresTable.amount}, 'term', ${feeStructuresTable.term}, 'dueDate', ${feeStructuresTable.dueDate})`,
      })
      .from(feePaymentsTable)
      .innerJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .leftJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id))
      .where(and(...filters));

    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /fee-structures/:id/generate-payments
// Creates pending fee_payment rows for every student in the fee structure's class.
// Skips students who already have a record for this fee structure (idempotent).
router.post("/fee-structures/:id/generate-payments", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const feeStructureId = parseInt(req.params["id"] as string);

      // Load the fee structure, scoped to this school
      const [fs] = await db
        .select({
          id: feeStructuresTable.id,
          classId: feeStructuresTable.classId,
          term: feeStructuresTable.term,
          amount: feeStructuresTable.amount,
          dueDate: feeStructuresTable.dueDate,
        })
        .from(feeStructuresTable)
        .innerJoin(classesTable, eq(feeStructuresTable.classId, classesTable.id))
        .where(and(eq(feeStructuresTable.id, feeStructureId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!fs) {
        res.status(404).json({ error: "Fee structure not found" });
        return;
      }

      // Get all students in the class
      const students = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.classId, fs.classId));

      if (students.length === 0) {
        res.json({ created: 0, skipped: 0 });
        return;
      }

      // Get existing payment records for this fee structure to skip them
      const existing = await db
        .select({ studentId: feePaymentsTable.studentId })
        .from(feePaymentsTable)
        .where(eq(feePaymentsTable.feeStructureId, feeStructureId));

      const existingIds = new Set(existing.map((e) => e.studentId));
      const toInsert = students
        .filter((s) => !existingIds.has(s.id))
        .map((s) => ({ studentId: s.id, feeStructureId, status: "pending" as const }));

      if (toInsert.length > 0) {
        await db.insert(feePaymentsTable).values(toInsert);
        // Fire-and-forget: only notify when this actually assigned new dues.
        notifyFeeDue({ term: fs.term, amount: fs.amount, dueDate: fs.dueDate, classId: fs.classId }, schoolId);
      }

      res.json({ created: toInsert.length, skipped: existingIds.size });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /fee-payments/:id/mark-paid — admin only
router.post("/fee-payments/:id/mark-paid", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params['id'] as string);

      const [existing] = await db
        .select({ id: feePaymentsTable.id })
        .from(feePaymentsTable)
        .innerJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id))
        .innerJoin(classesTable, eq(feeStructuresTable.classId, classesTable.id))
        .where(and(eq(feePaymentsTable.id, id), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const today = new Date().toISOString().split("T")[0];
      const [updated] = await db
        .update(feePaymentsTable)
        .set({ status: "paid", paidOn: today })
        .where(eq(feePaymentsTable.id, id))
        .returning();
      if (!updated) { res.status(404).json({ error: "Not found" }); return; }
      res.json({ ...updated, student: null, feeStructure: null });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
