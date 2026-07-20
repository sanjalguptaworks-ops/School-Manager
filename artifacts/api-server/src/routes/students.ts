import { Router } from "express";
import { db, studentsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { hashPassword, generateTempPassword } from "../lib/password";

const router = Router();

async function getStudentWithRelations(id: number, schoolId: number) {
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
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      },
      class: {
        id: classesTable.id,
        name: classesTable.name,
        section: classesTable.section,
      },
    })
    .from(studentsTable)
    .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(and(eq(studentsTable.id, id), eq(classesTable.schoolId, schoolId)))
    .limit(1);
  return rows[0] || null;
}

// GET /students
router.get("/students", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const { classId } = req.query as { classId?: string };
    const conditions = [eq(classesTable.schoolId, schoolId)];
    if (classId) conditions.push(eq(studentsTable.classId, parseInt(classId)));

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
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
        class: {
          id: classesTable.id,
          name: classesTable.name,
          section: classesTable.section,
        },
      })
      .from(studentsTable)
      .leftJoin(usersTable, eq(studentsTable.userId, usersTable.id))
      .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(and(...conditions));

    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /students — creates a local user record + student profile. Admin only.
router.post("/students", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { name, email, classId, rollNo, dob, guardianName, guardianContact } = req.body;
      if (!name || !email || !classId || !rollNo) {
        res.status(400).json({ error: "name, email, classId, rollNo required" });
        return;
      }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) {
        res.status(400).json({ error: "Invalid classId" });
        return;
      }

      const passwordHash = await hashPassword(generateTempPassword());
      const [user] = await db
        .insert(usersTable)
        .values({ name, email: String(email).toLowerCase(), role: "student", passwordHash, schoolId })
        .returning();

      const [student] = await db
        .insert(studentsTable)
        .values({ userId: user.id, classId, rollNo, dob, guardianName, guardianContact })
        .returning();

      const full = await getStudentWithRelations(student.id, schoolId);
      res.status(201).json(full);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /students/:id
router.get("/students/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const student = await getStudentWithRelations(id, schoolId);
    if (!student) return res.status(404).json({ error: "Not found" });
    return res.json(student);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /students/:id — admin only
router.patch("/students/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const existing = await getStudentWithRelations(id, schoolId);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }

      const { classId, rollNo, dob, guardianName, guardianContact } = req.body;
      const updates: Record<string, any> = {};
      if (classId !== undefined) {
        const [cls] = await db
          .select({ id: classesTable.id })
          .from(classesTable)
          .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
          .limit(1);
        if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }
        updates.classId = classId;
      }
      if (rollNo !== undefined) updates.rollNo = rollNo;
      if (dob !== undefined) updates.dob = dob;
      if (guardianName !== undefined) updates.guardianName = guardianName;
      if (guardianContact !== undefined) updates.guardianContact = guardianContact;

      await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id));
      const student = await getStudentWithRelations(id, schoolId);
      if (!student) { res.status(404).json({ error: "Not found" }); return; }
      res.json(student);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /students/:id — admin only
router.delete("/students/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const existing = await getStudentWithRelations(id, schoolId);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.delete(studentsTable).where(eq(studentsTable.id, id));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
