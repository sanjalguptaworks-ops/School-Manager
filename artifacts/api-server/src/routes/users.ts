import { Router } from "express";
import { db, usersTable, studentsTable, teachersTable, emailChangesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { hashPassword } from "../lib/password";
import { signEmailChangeToken, verifyEmailChangeToken } from "../lib/jwt";
import { sendEmailChangeConfirmation } from "../lib/mailer";
import crypto from "crypto";

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

// PATCH /users/me — logged-in user edits their own name/phone/email.
// Email changes are NOT applied immediately: a confirmation link is sent to
// the new address, and the address only switches once that link is clicked
// (see POST /users/confirm-email-change below).
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const { name, phone, email, avatarUrl } = req.body;

    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    if (!me) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const updates: Record<string, any> = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (typeof phone === "string") updates.phone = phone.trim() || null;
    if (typeof avatarUrl === "string") updates.avatarUrl = avatarUrl.trim() || null;

    let emailChangePending = false;

    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== me.email) {
        const clash = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
        if (clash[0]) {
          res.status(409).json({ error: "That email is already in use by another account" });
          return;
        }

        const token = signEmailChangeToken(authUserId, normalizedEmail);
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        // Clear out any earlier pending request before creating a new one
        await db.delete(emailChangesTable).where(eq(emailChangesTable.userId, authUserId));
        await db.insert(emailChangesTable).values({ userId: authUserId, newEmail: normalizedEmail, tokenHash, expiresAt });

        const frontendUrl = process.env["FRONTEND_URL"] || "";
        const confirmUrl = `${frontendUrl.replace(/\/$/, "")}/confirm-email-change?token=${token}`;
        try {
          await sendEmailChangeConfirmation(normalizedEmail, confirmUrl);
        } catch (mailErr) {
          req.log.error(mailErr, "Failed to send email change confirmation");
          res.status(502).json({ error: "Could not send the confirmation email. Please try again." });
          return;
        }
        emailChangePending = true;
      }
    }

    let updated = me;
    if (Object.keys(updates).length > 0) {
      const [row] = await db.update(usersTable).set(updates).where(eq(usersTable.id, authUserId)).returning();
      if (row) updated = row;
    }

    const { passwordHash, ...safeUser } = updated;
    res.json({ ...safeUser, emailChangePending });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /users/confirm-email-change — called when the user clicks the link
// sent to their NEW email address. This is what actually applies the change.
router.post("/users/confirm-email-change", async (req, res): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: "token is required" });
      return;
    }
    let userId: number;
    let newEmail: string;
    try {
      const decoded = verifyEmailChangeToken(token);
      userId = decoded.userId;
      newEmail = decoded.newEmail;
    } catch {
      res.status(400).json({ error: "Invalid or expired confirmation link" });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const rows = await db
      .select()
      .from(emailChangesTable)
      .where(
        and(
          eq(emailChangesTable.userId, userId),
          eq(emailChangesTable.tokenHash, tokenHash),
          gt(emailChangesTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      res.status(400).json({ error: "Invalid or expired confirmation link" });
      return;
    }

    // Guard against someone else grabbing that email in the meantime
    const clash = await db.select().from(usersTable).where(eq(usersTable.email, newEmail)).limit(1);
    if (clash[0] && clash[0].id !== userId) {
      res.status(409).json({ error: "That email is already in use by another account" });
      return;
    }

    await db.update(usersTable).set({ email: newEmail }).where(eq(usersTable.id, userId));
    await db.delete(emailChangesTable).where(eq(emailChangesTable.userId, userId));
    res.json({ ok: true, email: newEmail });
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
