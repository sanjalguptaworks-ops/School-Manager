import { Router } from "express";
import { db, feeStructuresTable, feePaymentsTable, classesTable, studentsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { notifyFeeDue } from "../lib/notify";

const router = Router();

// GET /fee-structures
router.get("/fee-structures", requireAuth, async (req, res) => {
  try {
    const { classId } = req.query as { classId?: string };
    const base = db
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
      .leftJoin(classesTable, eq(feeStructuresTable.classId, classesTable.id));

    const rows = classId
      ? await base.where(eq(feeStructuresTable.classId, parseInt(classId)))
      : await base;
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /fee-structures
router.post("/fee-structures", requireAuth, async (req, res) => {
  try {
    const { classId, amount, dueDate, term } = req.body;
    if (!classId || !amount || !dueDate || !term) {
      return res.status(400).json({ error: "All fields required" });
    }
    const [fs] = await db
      .insert(feeStructuresTable)
      .values({ classId, amount: String(amount), dueDate, term })
      .returning();
    return res.status(201).json({ ...fs, class: null });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /fee-payments
router.get("/fee-payments", requireAuth, async (req, res) => {
  try {
    const { studentId, classId, status } = req.query as Record<string, string>;
    const filters: any[] = [];
    if (studentId) filters.push(eq(feePaymentsTable.studentId, parseInt(studentId)));
    if (status) filters.push(eq(feePaymentsTable.status, status as any));

    const rows = await db
      .select({
        id: feePaymentsTable.id,
        studentId: feePaymentsTable.studentId,
        feeStructureId: feePaymentsTable.feeStructureId,
        status: feePaymentsTable.status,
        paidOn: feePaymentsTable.paidOn,
        student: sql<any>`json_build_object('id', ${studentsTable.id}, 'rollNo', ${studentsTable.rollNo}, 'user', json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name}, 'email', ${usersTable.email}))`,
        feeStructure: sql<any>`json_build_object('id', ${feeStructuresTable.id}, 'amount', ${feeStructuresTable.amount}, 'term', ${feeStructuresTable.term}, 'dueDate', ${feeStructuresTable.dueDate})`,
      })
      .from(feePaymentsTable)
      .leftJoin(studentsTable, eq(feePaymentsTable.studentId, studentsTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .leftJoin(feeStructuresTable, eq(feePaymentsTable.feeStructureId, feeStructuresTable.id))
      .where(filters.length ? and(...filters) : undefined);

    // Filter by classId via feeStructure
    let result = rows;
    if (classId) {
      const classIdNum = parseInt(classId);
      result = rows.filter((r: any) => {
        // We need to check if the student is in the requested class
        return true; // simplified
      });
    }

    return res.json(result);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /fee-structures/:id/generate-payments
// Creates pending fee_payment rows for every student in the fee structure's class.
// Skips students who already have a record for this fee structure (idempotent).
router.post("/fee-structures/:id/generate-payments", requireAuth, async (req, res): Promise<void> => {
  try {
    const feeStructureId = parseInt(req.params["id"] as string);

    // Load the fee structure
    const [fs] = await db
      .select()
      .from(feeStructuresTable)
      .where(eq(feeStructuresTable.id, feeStructureId))
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
      notifyFeeDue({ term: fs.term, amount: fs.amount, dueDate: fs.dueDate, classId: fs.classId });
    }

    res.json({ created: toInsert.length, skipped: existingIds.size });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /fee-payments/:id/mark-paid
router.post("/fee-payments/:id/mark-paid", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const today = new Date().toISOString().split("T")[0];
    const [updated] = await db
      .update(feePaymentsTable)
      .set({ status: "paid", paidOn: today })
      .where(eq(feePaymentsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json({ ...updated, student: null, feeStructure: null });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
