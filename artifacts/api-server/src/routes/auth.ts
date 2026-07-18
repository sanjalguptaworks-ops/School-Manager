import { Router } from "express";
import { db, usersTable, passwordResetsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, comparePassword } from "../lib/password";
import { signSession, signResetToken, verifyResetToken } from "../lib/jwt";
import { sendPasswordResetEmail } from "../lib/mailer";
import { requireAuth } from "../middlewares/auth";
import crypto from "crypto";

const router = Router();

const isProd = process.env["NODE_ENV"] === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, String(email).toLowerCase())).limit(1);
    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = signSession({ userId: user.id });
    res.cookie("session", token, cookieOptions);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/logout
router.post("/auth/logout", (req, res): void => {
  res.clearCookie("session", { path: "/" });
  res.status(204).send();
});

// POST /auth/forgot-password
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "email is required" });
      return;
    }
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, String(email).toLowerCase())).limit(1);
    const user = rows[0];

    // Always respond success so we don't leak which emails exist
    if (user) {
      const token = signResetToken(user.id);
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await db.insert(passwordResetsTable).values({ userId: user.id, tokenHash, expiresAt });

      const frontendUrl = process.env["FRONTEND_URL"] || "";
      const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        req.log.error(mailErr, "Failed to send password reset email");
      }
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/reset-password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: "token and password are required" });
      return;
    }
    let userId: number;
    try {
      userId = verifyResetToken(token).userId;
    } catch {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const rows = await db
      .select()
      .from(passwordResetsTable)
      .where(
        and(
          eq(passwordResetsTable.userId, userId),
          eq(passwordResetsTable.tokenHash, tokenHash),
          gt(passwordResetsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }
    const passwordHash = await hashPassword(password);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
    await db.delete(passwordResetsTable).where(eq(passwordResetsTable.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /auth/change-password (logged in)
router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  try {
    const authUserId = (req as any).authUserId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    const rows = await db.select().from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const user = rows[0];
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, authUserId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
