import { Router } from "express";
import { db, certificatesTable, studentsTable, usersTable, classesTable, schoolsTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";

const router = Router();

async function attachIssuerNames<T extends { issuedBy: number | null }>(rows: T[]): Promise<(T & { issuedByName: string | null })[]> {
  const issuerIds = [...new Set(rows.map((r) => r.issuedBy).filter((id): id is number => id !== null))];
  const issuers = issuerIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, issuerIds))
    : [];
  const nameById = new Map(issuers.map((i) => [i.id, i.name]));
  return rows.map((r) => ({ ...r, issuedByName: r.issuedBy !== null ? nameById.get(r.issuedBy) ?? null : null }));
}

// GET /certificates — admin/teacher see every certificate in their school
// (optionally filtered by ?studentId=), students/parents only their own.
router.get("/certificates", requireAuth, requireSchool, async (req, res): Promise<void> => {
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

    const filters = [eq(classesTable.schoolId, schoolId)];
    if (studentId) filters.push(eq(certificatesTable.studentId, parseInt(studentId)));
    else if (scope.kind === "restricted") filters.push(inArray(certificatesTable.studentId, scope.studentIds));

    const rows = await db
      .select({
        id: certificatesTable.id,
        studentId: certificatesTable.studentId,
        title: certificatesTable.title,
        body: certificatesTable.body,
        issueDate: certificatesTable.issueDate,
        issuedBy: certificatesTable.issuedBy,
        createdAt: certificatesTable.createdAt,
        student: {
          id: studentsTable.id,
          rollNo: studentsTable.rollNo,
          name: usersTable.name,
        },
      })
      .from(certificatesTable)
      .innerJoin(studentsTable, eq(certificatesTable.studentId, studentsTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .where(and(...filters))
      .orderBy(desc(certificatesTable.createdAt));

    res.json(await attachIssuerNames(rows));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /certificates — admin only.
router.post("/certificates", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { studentId, title, body, issueDate } = req.body;

      if (!studentId || !title?.trim() || !body?.trim() || !issueDate) {
        res.status(400).json({ error: "studentId, title, body, and issueDate are required" });
        return;
      }

      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(eq(studentsTable.id, studentId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!student) {
        res.status(400).json({ error: "Invalid studentId" });
        return;
      }

      const [certificate] = await db
        .insert(certificatesTable)
        .values({ studentId, title: title.trim(), body: body.trim(), issueDate, issuedBy: authUserId })
        .returning();

      res.status(201).json(certificate);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /certificates/:id — the print/view page's data source.
router.get("/certificates/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;

    const [row] = await db
      .select({
        id: certificatesTable.id,
        studentId: certificatesTable.studentId,
        title: certificatesTable.title,
        body: certificatesTable.body,
        issueDate: certificatesTable.issueDate,
        issuedBy: certificatesTable.issuedBy,
        createdAt: certificatesTable.createdAt,
        student: {
          id: studentsTable.id,
          rollNo: studentsTable.rollNo,
          name: usersTable.name,
        },
      })
      .from(certificatesTable)
      .innerJoin(studentsTable, eq(certificatesTable.studentId, studentsTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .where(and(eq(certificatesTable.id, id), eq(classesTable.schoolId, schoolId)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const scope = await getStudentAccessScope(authUserId);
    if (!canAccessStudent(scope, row.studentId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [school] = await db
      .select({ name: schoolsTable.name, certificateTemplateUrl: schoolsTable.certificateTemplateUrl })
      .from(schoolsTable)
      .where(eq(schoolsTable.id, schoolId))
      .limit(1);

    const [withIssuer] = await attachIssuerNames([row]);
    res.json({ ...withIssuer, school });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /certificates/:id — admin only, in case one was issued by mistake.
router.delete("/certificates/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;

      const [existing] = await db
        .select({ id: certificatesTable.id })
        .from(certificatesTable)
        .innerJoin(studentsTable, eq(certificatesTable.studentId, studentsTable.id))
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(eq(certificatesTable.id, id), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      await db.delete(certificatesTable).where(eq(certificatesTable.id, id));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
