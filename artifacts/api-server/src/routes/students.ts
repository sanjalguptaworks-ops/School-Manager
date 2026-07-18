import { Router } from "express";
import { db, studentsTable, usersTable, classesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { hashPassword, generateTempPassword } from "../lib/password";

const router = Router();

async function getStudentWithRelations(id: number) {
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
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.id, id))
    .limit(1);
  return rows[0] || null;
}

// GET /students
router.get("/students", requireAuth, async (req, res) => {
  try {
    const { classId } = req.query as { classId?: string };
    const conditions = classId
      ? [eq(studentsTable.classId, parseInt(classId))]
      : [];

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
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(conditions.length ? and(...conditions) : undefined);

    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /students — creates a local user record + student profile
router.post("/students", requireAuth, async (req, res) => {
  try {
    const { name, email, classId, rollNo, dob, guardianName, guardianContact } = req.body;
    if (!name || !email || !classId || !rollNo) {
      return res.status(400).json({ error: "name, email, classId, rollNo required" });
    }

    const passwordHash = await hashPassword(generateTempPassword());
    const [user] = await db
      .insert(usersTable)
      .values({ name, email: String(email).toLowerCase(), role: "student", passwordHash })
      .returning();

    const [student] = await db
      .insert(studentsTable)
      .values({ userId: user.id, classId, rollNo, dob, guardianName, guardianContact })
      .returning();

    const full = await getStudentWithRelations(student.id);
    return res.status(201).json(full);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /students/:id
router.get("/students/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const student = await getStudentWithRelations(id);
    if (!student) return res.status(404).json({ error: "Not found" });
    return res.json(student);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /students/:id
router.patch("/students/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const { classId, rollNo, dob, guardianName, guardianContact } = req.body;
    const updates: Record<string, any> = {};
    if (classId !== undefined) updates.classId = classId;
    if (rollNo !== undefined) updates.rollNo = rollNo;
    if (dob !== undefined) updates.dob = dob;
    if (guardianName !== undefined) updates.guardianName = guardianName;
    if (guardianContact !== undefined) updates.guardianContact = guardianContact;

    await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id));
    const student = await getStudentWithRelations(id);
    if (!student) return res.status(404).json({ error: "Not found" });
    return res.json(student);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /students/:id
router.delete("/students/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    await db.delete(studentsTable).where(eq(studentsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
