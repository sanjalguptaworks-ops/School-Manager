import { Router } from "express";
import { db, disciplineIncidentsTable, studentsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

const router = Router();

function selectFields() {
  return {
    id: disciplineIncidentsTable.id,
    studentId: disciplineIncidentsTable.studentId,
    title: disciplineIncidentsTable.title,
    description: disciplineIncidentsTable.description,
    severity: disciplineIncidentsTable.severity,
    reportedBy: disciplineIncidentsTable.reportedBy,
    createdAt: disciplineIncidentsTable.createdAt,
  };
}

// GET /discipline-incidents — admin/teacher (scoped to their classes);
// parent sees only their linked children's incidents. Never visible to
// students themselves.
router.get("/discipline-incidents", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    if (user?.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const filters: any[] = [eq(disciplineIncidentsTable.schoolId, schoolId)];

    if (user?.role === "parent") {
      const scope = await getStudentAccessScope(authUserId);
      if (studentId && !canAccessStudent(scope, parseInt(studentId))) { res.status(403).json({ error: "Forbidden" }); return; }
      if (scope.kind === "restricted" && scope.studentIds.length === 0) { res.json([]); return; }
      if (studentId) filters.push(eq(disciplineIncidentsTable.studentId, parseInt(studentId)));
      else if (scope.kind === "restricted") filters.push(inArray(disciplineIncidentsTable.studentId, scope.studentIds));
    } else {
      // admin/teacher
      const classScope = await getTeacherClassScope(authUserId);
      if (studentId) {
        const [student] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.id, parseInt(studentId))).limit(1);
        if (!student || !canAccessClass(classScope, student.classId)) { res.status(403).json({ error: "Forbidden" }); return; }
        filters.push(eq(disciplineIncidentsTable.studentId, parseInt(studentId)));
      } else if (classScope.kind === "restricted") {
        if (classScope.classIds.length === 0) { res.json([]); return; }
        const students = await db.select({ id: studentsTable.id }).from(studentsTable).where(inArray(studentsTable.classId, classScope.classIds));
        if (students.length === 0) { res.json([]); return; }
        filters.push(inArray(disciplineIncidentsTable.studentId, students.map((s) => s.id)));
      }
    }

    const rows = await db
      .select({
        ...selectFields(),
        student: { id: studentsTable.id, rollNo: studentsTable.rollNo, name: usersTable.name },
      })
      .from(disciplineIncidentsTable)
      .innerJoin(studentsTable, eq(disciplineIncidentsTable.studentId, studentsTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .where(and(...filters))
      .orderBy(desc(disciplineIncidentsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /discipline-incidents — admin or teacher (scoped to their classes)
router.post("/discipline-incidents", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { studentId, title, description, severity } = req.body;

      if (!studentId || !title?.trim()) {
        res.status(400).json({ error: "studentId and title are required" });
        return;
      }
      if (severity && !["minor", "moderate", "severe"].includes(severity)) {
        res.status(400).json({ error: "severity must be minor, moderate, or severe" });
        return;
      }

      const [student] = await db
        .select({ id: studentsTable.id, classId: studentsTable.classId })
        .from(studentsTable)
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(eq(studentsTable.id, studentId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!student) { res.status(400).json({ error: "Invalid studentId" }); return; }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, student.classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [incident] = await db
        .insert(disciplineIncidentsTable)
        .values({
          studentId,
          title: title.trim(),
          description: description?.trim() || null,
          severity: severity || "minor",
          reportedBy: authUserId,
          schoolId,
        })
        .returning();

      res.status(201).json(incident);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /discipline-incidents/:id — admin any; teacher scoped to that class
router.delete("/discipline-incidents/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;

      const [existing] = await db
        .select({ id: disciplineIncidentsTable.id, classId: studentsTable.classId })
        .from(disciplineIncidentsTable)
        .innerJoin(studentsTable, eq(disciplineIncidentsTable.studentId, studentsTable.id))
        .where(and(eq(disciplineIncidentsTable.id, id), eq(disciplineIncidentsTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, existing.classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      await db.delete(disciplineIncidentsTable).where(eq(disciplineIncidentsTable.id, id));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
