import { Router } from "express";
import { db, teachersTable, usersTable, teacherClassesTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { hashPassword, generateTempPassword } from "../lib/password";
import { sendWelcomeEmail } from "../lib/mailer";
import { isEmailEnabledForSchool } from "../lib/school-settings";

const router = Router();

async function getTeacherClasses(teacherId: number) {
  return db
    .select({ id: classesTable.id, name: classesTable.name, section: classesTable.section })
    .from(teacherClassesTable)
    .innerJoin(classesTable, eq(teacherClassesTable.classId, classesTable.id))
    .where(eq(teacherClassesTable.teacherId, teacherId));
}

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
        phone: usersTable.phone,
        avatarUrl: usersTable.avatarUrl,
        role: usersTable.role,
        createdAt: usersTable.createdAt,
      },
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(and(eq(teachersTable.id, id), eq(usersTable.schoolId, schoolId)))
    .limit(1);
  const teacher = rows[0];
  if (!teacher) return null;
  const classes = await getTeacherClasses(teacher.id);
  return { ...teacher, classes };
}

// GET /teachers — includes each teacher's assigned classes (empty array
// means "unrestricted", see lib/teacher-access.ts).
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
          phone: usersTable.phone,
          avatarUrl: usersTable.avatarUrl,
          role: usersTable.role,
          createdAt: usersTable.createdAt,
        },
      })
      .from(teachersTable)
      .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(usersTable.schoolId, schoolId));

    const withClasses = await Promise.all(rows.map(async (t) => ({ ...t, classes: await getTeacherClasses(t.id) })));
    return res.json(withClasses);
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
      let emailSent = false;
      if (await isEmailEnabledForSchool(schoolId)) {
        try {
          await sendWelcomeEmail(user.email, user.name, tempPassword);
          emailSent = true;
        } catch (mailErr) {
          req.log.error(mailErr, "Failed to send teacher welcome email");
        }
      }

      const full = await getTeacherWithUser(teacher.id, schoolId);
      res.status(201).json({ ...full, tempPassword, emailSent });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /teachers/bulk-import — admin only. Body: { rows: [{ name, email,
// subjects? }] }. Same per-row error reporting as /students/bulk-import.
router.post("/teachers/bulk-import", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: "rows array required" });
        return;
      }
      if (rows.length > 500) {
        res.status(400).json({ error: "Max 500 rows per import" });
        return;
      }

      const emailEnabled = await isEmailEnabledForSchool(schoolId);
      const results: Array<{ row: number; email: string; success: boolean; error?: string; tempPassword?: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || {};
        const email = String(row.email || "").trim();
        try {
          const { name, subjects } = row;
          if (!name || !email) {
            results.push({ row: i, email, success: false, error: "Missing required field(s)" });
            continue;
          }

          const normalizedEmail = email.toLowerCase();
          const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail)).limit(1);
          if (existingUser) {
            results.push({ row: i, email, success: false, error: "Email already in use" });
            continue;
          }

          const tempPassword = generateTempPassword();
          const passwordHash = await hashPassword(tempPassword);
          const [user] = await db
            .insert(usersTable)
            .values({ name, email: normalizedEmail, role: "teacher", passwordHash, schoolId })
            .returning();
          await db.insert(teachersTable).values({ userId: user.id, subjects: Array.isArray(subjects) ? subjects : [] });

          if (emailEnabled) {
            sendWelcomeEmail(user.email, user.name, tempPassword).catch((mailErr) =>
              req.log.error(mailErr, "Bulk import welcome email failed"),
            );
          }

          results.push({ row: i, email: normalizedEmail, success: true, tempPassword });
        } catch (rowErr) {
          req.log.error(rowErr);
          results.push({ row: i, email, success: false, error: "Unexpected error" });
        }
      }

      res.json({ results });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /teachers/:id
// Admin sees any teacher in the school; a teacher only their own record --
// otherwise any authenticated student/parent could pass an arbitrary teacher
// id and read their phone number/email.
router.get("/teachers/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;

    const [requester] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const teacher = await getTeacherWithUser(id, schoolId);
    if (!teacher) return res.status(404).json({ error: "Not found" });

    if (requester?.role !== "admin" && teacher.userId !== authUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

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

// POST /teachers/:id/classes — admin only. Assigns a teacher to a class. A
// teacher with zero assignments sees the whole school (unrestricted); their
// first assignment switches them over to seeing only assigned classes.
router.post("/teachers/:id/classes", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const schoolId = (req as any).schoolId;
      const { classId } = req.body;
      if (!classId) { res.status(400).json({ error: "classId required" }); return; }

      const teacher = await getTeacherWithUser(id, schoolId);
      if (!teacher) { res.status(404).json({ error: "Not found" }); return; }

      const [cls] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!cls) { res.status(400).json({ error: "Invalid classId" }); return; }

      await db.insert(teacherClassesTable).values({ teacherId: id, classId }).onConflictDoNothing();
      const full = await getTeacherWithUser(id, schoolId);
      res.status(201).json(full);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /teachers/:id/classes/:classId — admin only.
router.delete("/teachers/:id/classes/:classId", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const id = parseInt(req.params['id'] as string);
      const classId = parseInt(req.params['classId'] as string);
      const schoolId = (req as any).schoolId;

      const teacher = await getTeacherWithUser(id, schoolId);
      if (!teacher) { res.status(404).json({ error: "Not found" }); return; }

      await db
        .delete(teacherClassesTable)
        .where(and(eq(teacherClassesTable.teacherId, id), eq(teacherClassesTable.classId, classId)));
      const full = await getTeacherWithUser(id, schoolId);
      res.json(full);
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
