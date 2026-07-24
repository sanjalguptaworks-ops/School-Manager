import { Router } from "express";
import { db, libraryBooksTable, libraryLoansTable, studentsTable, usersTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";

const router = Router();

// GET /library/books — everyone in the school can browse the catalog.
router.get("/library/books", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const books = await db.select().from(libraryBooksTable).where(eq(libraryBooksTable.schoolId, schoolId));
    res.json(books);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /library/books — admin/teacher only.
router.post("/library/books", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { title, author, isbn, totalCopies } = req.body;
      if (!title || !author) {
        res.status(400).json({ error: "title, author required" });
        return;
      }
      const copies = typeof totalCopies === "number" && totalCopies > 0 ? Math.floor(totalCopies) : 1;
      const [book] = await db
        .insert(libraryBooksTable)
        .values({ schoolId, title, author, isbn: isbn || null, totalCopies: copies, availableCopies: copies })
        .returning();
      res.status(201).json(book);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// PATCH /library/books/:id — admin/teacher only. Changing totalCopies shifts
// availableCopies by the same delta, so existing loans aren't disturbed.
router.patch("/library/books/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [existing] = await db
        .select()
        .from(libraryBooksTable)
        .where(and(eq(libraryBooksTable.id, id), eq(libraryBooksTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const { title, author, isbn, totalCopies } = req.body;
      const updates: Record<string, any> = {};
      if (typeof title === "string" && title.trim()) updates.title = title.trim();
      if (typeof author === "string" && author.trim()) updates.author = author.trim();
      if (isbn === null || typeof isbn === "string") updates.isbn = isbn || null;
      if (typeof totalCopies === "number" && totalCopies > 0) {
        const delta = Math.floor(totalCopies) - existing.totalCopies;
        updates.totalCopies = Math.floor(totalCopies);
        updates.availableCopies = Math.max(0, existing.availableCopies + delta);
      }

      const [updated] = await db.update(libraryBooksTable).set(updates).where(eq(libraryBooksTable.id, id)).returning();
      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /library/books/:id — admin/teacher only.
router.delete("/library/books/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      await db.delete(libraryBooksTable).where(and(eq(libraryBooksTable.id, id), eq(libraryBooksTable.schoolId, schoolId)));
      res.json({ ok: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

async function buildLoanQuery(filters: any[]) {
  return db
    .select({
      id: libraryLoansTable.id,
      bookId: libraryLoansTable.bookId,
      studentId: libraryLoansTable.studentId,
      issuedAt: libraryLoansTable.issuedAt,
      dueDate: libraryLoansTable.dueDate,
      returnedAt: libraryLoansTable.returnedAt,
      fineAmount: libraryLoansTable.fineAmount,
      book: { id: libraryBooksTable.id, title: libraryBooksTable.title, author: libraryBooksTable.author },
      student: {
        id: studentsTable.id,
        rollNo: studentsTable.rollNo,
        user: sql<any>`json_build_object('id', ${usersTable.id}, 'name', ${usersTable.name})`,
      },
    })
    .from(libraryLoansTable)
    .innerJoin(libraryBooksTable, eq(libraryLoansTable.bookId, libraryBooksTable.id))
    .innerJoin(studentsTable, eq(libraryLoansTable.studentId, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .where(and(...filters));
}

// GET /library/loans — admin/teacher see everything (optionally filtered by
// studentId); student/parent are restricted to their own/linked children.
router.get("/library/loans", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { studentId } = req.query as Record<string, string>;

    const scope = await getStudentAccessScope(authUserId);
    if (studentId && !canAccessStudent(scope, parseInt(studentId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (scope.kind === "restricted" && scope.studentIds.length === 0) {
      res.json([]);
      return;
    }

    const filters: any[] = [eq(libraryLoansTable.schoolId, schoolId)];
    if (studentId) filters.push(eq(libraryLoansTable.studentId, parseInt(studentId)));
    else if (scope.kind === "restricted") filters.push(inArray(libraryLoansTable.studentId, scope.studentIds));

    const loans = await buildLoanQuery(filters);
    res.json(loans);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /library/loans — admin/teacher only. Issues a copy of a book to a
// student, decrementing availableCopies.
router.post("/library/loans", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { bookId, studentId, dueDate } = req.body;
      if (!bookId || !studentId || !dueDate) {
        res.status(400).json({ error: "bookId, studentId, dueDate required" });
        return;
      }

      const [book] = await db
        .select()
        .from(libraryBooksTable)
        .where(and(eq(libraryBooksTable.id, bookId), eq(libraryBooksTable.schoolId, schoolId)))
        .limit(1);
      if (!book) {
        res.status(400).json({ error: "Invalid bookId" });
        return;
      }
      if (book.availableCopies <= 0) {
        res.status(400).json({ error: "No copies available" });
        return;
      }

      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .where(and(eq(studentsTable.id, studentId), eq(usersTable.schoolId, schoolId)))
        .limit(1);
      if (!student) {
        res.status(400).json({ error: "Invalid studentId" });
        return;
      }

      const today = new Date().toISOString().split("T")[0] as string;
      const [loan] = await db
        .insert(libraryLoansTable)
        .values({ schoolId, bookId, studentId, issuedAt: today, dueDate })
        .returning();
      await db
        .update(libraryBooksTable)
        .set({ availableCopies: book.availableCopies - 1 })
        .where(eq(libraryBooksTable.id, bookId));

      res.status(201).json(loan);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /library/loans/:id/return — admin/teacher only. Marks returned and
// restores the copy to the available pool.
router.post("/library/loans/:id/return", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const { fineAmount } = req.body;

      const [loan] = await db
        .select()
        .from(libraryLoansTable)
        .where(and(eq(libraryLoansTable.id, id), eq(libraryLoansTable.schoolId, schoolId)))
        .limit(1);
      if (!loan) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (loan.returnedAt) {
        res.status(400).json({ error: "Already returned" });
        return;
      }

      const today = new Date().toISOString().split("T")[0] as string;
      const [updated] = await db
        .update(libraryLoansTable)
        .set({ returnedAt: today, fineAmount: typeof fineAmount === "number" ? String(fineAmount) : null })
        .where(eq(libraryLoansTable.id, id))
        .returning();

      const [book] = await db.select().from(libraryBooksTable).where(eq(libraryBooksTable.id, loan.bookId)).limit(1);
      if (book) {
        await db
          .update(libraryBooksTable)
          .set({ availableCopies: Math.min(book.totalCopies, book.availableCopies + 1) })
          .where(eq(libraryBooksTable.id, book.id));
      }

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
