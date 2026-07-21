/**
 * POST /api/invite
 * Admin-only: creates a DB account for any role, with a generated temp password.
 * Returns the temporary password (shown once to the admin).
 */
import { Router } from "express";
import { db, usersTable, studentsTable, teachersTable, classesTable, parentStudentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { hashPassword, generateTempPassword } from "../lib/password";
import { sendWelcomeEmail } from "../lib/mailer";
import { isEmailEnabledForSchool } from "../lib/school-settings";

const router = Router();

router.post("/invite", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
  try {
    const {
      name,
      email,
      role,
      // Teacher-specific
      subjects,
      // Student-specific
      classId,
      rollNo,
      dob,
      guardianName,
      guardianContact,
      // Parent-specific
      studentIds,
    } = req.body;

    if (!name || !email || !role) {
      res.status(400).json({ error: "name, email, role are required" });
      return;
    }

    const validRoles = ["admin", "teacher", "student", "parent"];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    if (role === "student" && (!classId || !rollNo)) {
      res.status(400).json({ error: "classId and rollNo are required for students" });
      return;
    }

    const authUserId = (req as any).authUserId;
    const [me] = await db.select({ schoolId: usersTable.schoolId }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    if (!me?.schoolId) {
      res.status(403).json({ error: "Your account isn't linked to a school" });
      return;
    }

    const normalizedEmail = String(email).toLowerCase();
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const [dbUser] = await db
      .insert(usersTable)
      .values({ name, email: normalizedEmail, role, passwordHash, schoolId: me.schoolId })
      .returning();

    let teacherId: number | null = null;
    let studentId: number | null = null;

    if (role === "teacher") {
      const [teacher] = await db
        .insert(teachersTable)
        .values({ userId: dbUser.id, subjects: subjects || [] })
        .returning();
      teacherId = teacher.id;
    }

    if (role === "student") {
      const [student] = await db
        .insert(studentsTable)
        .values({ userId: dbUser.id, classId, rollNo, dob, guardianName, guardianContact })
        .returning();
      studentId = student.id;
    }

    if (role === "parent" && Array.isArray(studentIds) && studentIds.length > 0) {
      // Only link students that actually belong to this admin's own school --
      // otherwise a passed-in ID from another school would create a
      // cross-school parent/student link.
      const validStudents = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(inArray(studentsTable.id, studentIds), eq(classesTable.schoolId, me.schoolId)));
      const validIds = new Set(validStudents.map((s) => s.id));
      const links = studentIds.filter((sid: number) => validIds.has(sid)).map((sid: number) => ({ parentId: dbUser.id, studentId: sid }));
      if (links.length > 0) {
        await db.insert(parentStudentsTable).values(links).onConflictDoNothing();
      }
    }

    let emailSent = false;
    if (await isEmailEnabledForSchool(me.schoolId)) {
      try {
        await sendWelcomeEmail(dbUser.email, dbUser.name, tempPassword);
        emailSent = true;
      } catch (mailErr) {
        req.log.error(mailErr, "Failed to send invite welcome email");
      }
    }

    const { passwordHash: _omit, ...safeUser } = dbUser;
    res.status(201).json({
      user: safeUser,
      tempPassword,
      teacherId,
      studentId,
      emailSent,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
  });
});

export default router;
