import { Router } from "express";
import { db, usersTable, studentsTable, teachersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { hashPassword } from "../lib/password";

const router = Router();

// GET /users/me — return the logged-in user + studentId/teacherId
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const existing = await db.select().from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const user = existing[0];
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const extra: Record<string, number | null> = { studentId: null, teacherId: null };
    if (user.role === "student") {
      const [s] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, user.id)).limit(1);
      extra.studentId = s?.id ?? null;
    }
    if (user.role === "teacher") {
      const [t] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, user.id)).limit(1);
      extra.teacherId = t?.id ?? null;
    }
    const { passwordHash, ...safeUser } = user;
    res.json({ ...safeUser, ...extra });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users
router.get("/users", requireAuth, async (req, res): Promise<void> => {
  try {
    const { role } = req.query as { role?: string };
    const rows = role
      ? await db.select().from(usersTable).where(eq(usersTable.role, role as any))
      : await db.select().from(usersTable);
    res.json(rows.map(({ passwordHash, ...u }) => u));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /users (admin creates a user directly with a temp password)
router.post("/users", requireAuth, async (req, res): Promise<void> => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role || !password) {
      res.status(400).json({ error: "name, email, role, password required" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({ name, email: String(email).toLowerCase(), role, passwordHash })
      .returning();
    const { passwordHash: _omit, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /users/:id
router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const { name, role } = req.body;
    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const { passwordHash, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /users/:id
router.delete("/users/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
