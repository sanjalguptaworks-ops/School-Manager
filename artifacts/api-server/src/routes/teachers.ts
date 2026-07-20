import { Router } from "express";
import { db, teachersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { hashPassword, generateTempPassword } from "../lib/password";

const router = Router();

async function getTeacherWithUser(id: number, schoolId: number) {
  const rows = await db
    .select({
      id: teachersTable.id,
      userId: teachersTable.userId,
      subjects: teachersTable.subjects,
      user: {
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      },
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(and(eq(teachersTable.id, id), eq(usersTable.schoolId, schoolId)))
    .limit(1);
  return rows[0] || null;
}

// GET /teachers
router.get("/teachers", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const rows = await db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
        subjects: teachersTable.subjects,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
      })
      .from(teachersTable)
      .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(usersTable.schoolId, schoolId));
    return res.json(rows);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /teachers — admin only
router.post("/teachers", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { name, email, subjects = [] } = req.body;
      if (!name || !email) {
        res.status(400).json({ error: "name and email required" });
        return;
      }
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const [user] = await db
        .insert(usersTable)
        .values({ name, email: String(email).toLowerCase(), role: "teacher", passwordHash, schoolId })
        .returning();
      const [teacher] = await db
        .insert(teachersTable)
        .values({ userId: user.id, subjects })
        .returning();
      const full = await getTeacherWithUser(teacher.id, schoolId);
      res.status(201).json({ ...full, tempPassword });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /teachers/:id
router.get("/teachers/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const teacher = await getTeacherWithUser(id, schoolId);
    if (!teacher) return res.status(404).json({ error: "Not found" });
    return res.json(teacher);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /teachers/:id — admin only
router.patch("/teachers/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const existing = await getTeacherWithUser(id, schoolId);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      const { subjects } = req.body;
      if (subjects !== undefined) {
        await db.update(teachersTable).set({ subjects }).where(eq(teachersTable.id, id));
      }
      const teacher = await getTeacherWithUser(id, schoolId);
      if (!teacher) { res.status(404).json({ error: "Not found" }); return; }
      res.json(teacher);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /teachers/:id — admin only
router.delete("/teachers/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const existing = await getTeacherWithUser(id, schoolId);
      if (!existing) { res.status(404).json({ error: "Not found" }); return; }
      await db.delete(teachersTable).where(eq(teachersTable.id, id));
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
