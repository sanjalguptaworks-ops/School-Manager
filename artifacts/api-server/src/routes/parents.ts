import { Router } from "express";
import { db, parentStudentsTable, studentsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole, loadUser } from "../middlewares/auth";

const router = Router();

// GET /parents/:parentId/students  — list children linked to a parent.
// Admin/teacher can view any parent; a parent can only view their own.
router.get("/parents/:parentId/students", requireAuth, requireSchool, loadUser, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const dbUser = (req as any).dbUser;
    const parentId = parseInt(req.params["parentId"] as string);

    if (!["admin", "teacher"].includes(dbUser?.role) && dbUser?.id !== parentId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [parent] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, parentId), eq(usersTable.schoolId, schoolId)))
      .limit(1);
    if (!parent) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const rows = await db
      .select({
        id: studentsTable.id,
        userId: studentsTable.userId,
        classId: studentsTable.classId,
        rollNo: studentsTable.rollNo,
        dob: studentsTable.dob,
        guardianName: studentsTable.guardianName,
        guardianContact: studentsTable.guardianContact,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          phone: usersTable.phone,
          avatarUrl: usersTable.avatarUrl,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
        class: {
          id: classesTable.id,
          name: classesTable.name,
          section: classesTable.section,
        },
      })
      .from(parentStudentsTable)
      .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .where(and(eq(parentStudentsTable.parentId, parentId), eq(classesTable.schoolId, schoolId)));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /parents/:parentId/link-student — admin only
router.post("/parents/:parentId/link-student", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const parentId = parseInt(req.params["parentId"] as string);
      const { studentId } = req.body;
      if (!studentId) {
        res.status(400).json({ error: "studentId required" });
        return;
      }

      const [parent] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, parentId), eq(usersTable.schoolId, schoolId)))
        .limit(1);
      if (!parent) {
        res.status(404).json({ error: "Parent not found" });
        return;
      }

      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(eq(studentsTable.id, studentId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!student) {
        res.status(404).json({ error: "Student not found" });
        return;
      }

      await db
        .insert(parentStudentsTable)
        .values({ parentId, studentId })
        .onConflictDoNothing();
      res.json({ ok: true });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /parents/:parentId/link-student/:studentId — admin only
router.delete("/parents/:parentId/link-student/:studentId", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const parentId = parseInt(req.params["parentId"] as string);
      const studentId = parseInt(req.params["studentId"] as string);

      const [parent] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, parentId), eq(usersTable.schoolId, schoolId)))
        .limit(1);
      if (!parent) {
        res.status(404).json({ error: "Parent not found" });
        return;
      }

      await db
        .delete(parentStudentsTable)
        .where(and(eq(parentStudentsTable.parentId, parentId), eq(parentStudentsTable.studentId, studentId)));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// Note: a student/parent summary endpoint used to live here too, at the same
// path shape as students.ts's GET /students/:id/summary. Since studentsRouter
// is registered before parentsRouter (see routes/index.ts), this one was
// silently shadowed and never actually ran -- removed in favor of the single
// implementation in students.ts (which now also folds in "late" attendance
// toward the rate, matching what this version used to do).

export default router;
