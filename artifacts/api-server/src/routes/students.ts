import { Router } from "express";
import { db, studentsTable, usersTable, classesTable, attendanceTable, feePaymentsTable, marksTable, examsTable, parentStudentsTable } from "@workspace/db";
import { eq, and, sql, gte, desc, asc, inArray } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { hashPassword, generateTempPassword } from "../lib/password";
import { sendWelcomeEmail } from "../lib/mailer";
import { isEmailEnabledForSchool } from "../lib/school-settings";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";

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
        phone: usersTable.phone,
        avatarUrl: usersTable.avatarUrl,
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

// GET /students — a teacher assigned to specific classes only sees students
// in those classes; everyone else sees the whole school, as before.
router.get("/students", requireAuth, requireSchool, async (req, res) => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId } = req.query as { classId?: string };

    const scope = await getTeacherClassScope(authUserId);
    if (classId && !canAccessClass(scope, parseInt(classId))) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (scope.kind === "restricted" && scope.classIds.length === 0) {
      return res.json([]);
    }

    const conditions = [eq(classesTable.schoolId, schoolId)];
    if (classId) conditions.push(eq(studentsTable.classId, parseInt(classId)));
    else if (scope.kind === "restricted") conditions.push(inArray(studentsTable.classId, scope.classIds));

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
          phone: usersTable.phone,
          avatarUrl: usersTable.avatarUrl,
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

      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const [user] = await db
        .insert(usersTable)
        .values({ name, email: String(email).toLowerCase(), role: "student", passwordHash, schoolId })
        .returning();

      const [student] = await db
        .insert(studentsTable)
        .values({ userId: user.id, classId, rollNo, dob, guardianName, guardianContact })
        .returning();

      let emailSent = false;
      if (await isEmailEnabledForSchool(schoolId)) {
        try {
          await sendWelcomeEmail(user.email, user.name, tempPassword);
          emailSent = true;
        } catch (mailErr) {
          req.log.error(mailErr, "Failed to send student welcome email");
        }
      }

      const full = await getStudentWithRelations(student.id, schoolId);
      res.status(201).json({ ...full, tempPassword, emailSent });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /students/bulk-import — admin only. Body: { rows: [{ name, email,
// rollNo, className, section, dob?, guardianName?, guardianContact? }] }.
// Each row is processed independently so one bad row doesn't fail the whole
// batch; the response reports per-row success/failure and temp passwords.
router.post("/students/bulk-import", requireAuth, requireSchool, async (req, res): Promise<void> => {
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
          const { name, rollNo, className, section, dob, guardianName, guardianContact } = row;
          if (!name || !email || !rollNo || !className || !section) {
            results.push({ row: i, email, success: false, error: "Missing required field(s)" });
            continue;
          }

          const [cls] = await db
            .select({ id: classesTable.id })
            .from(classesTable)
            .where(and(eq(classesTable.schoolId, schoolId), eq(classesTable.name, className), eq(classesTable.section, section)))
            .limit(1);
          if (!cls) {
            results.push({ row: i, email, success: false, error: `Class "${className} ${section}" not found` });
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
            .values({ name, email: normalizedEmail, role: "student", passwordHash, schoolId })
            .returning();
          await db
            .insert(studentsTable)
            .values({ userId: user.id, classId: cls.id, rollNo, dob: dob || null, guardianName: guardianName || null, guardianContact: guardianContact || null });

          if (emailEnabled) {
            // Fire-and-forget so one slow email doesn't stall the whole batch.
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

// GET /students/:id — staff see any student in their school; a student or
// parent only their own/linked record (same access model as /summary,
// otherwise any authenticated student could pass an arbitrary id and read
// another family's phone/dob/guardian contact). A teacher scoped to specific
// classes is further restricted to students in those classes -- otherwise
// they could bypass that restriction just by requesting a student directly
// by id instead of going through the (correctly scoped) list endpoint.
router.get("/students/:id", requireAuth, requireSchool, async (req, res) => {
  try {
    const id = parseInt(req.params['id'] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;

    const scope = await getStudentAccessScope(authUserId);
    if (!canAccessStudent(scope, id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const student = await getStudentWithRelations(id, schoolId);
    if (!student) return res.status(404).json({ error: "Not found" });

    const classScope = await getTeacherClassScope(authUserId);
    if (!canAccessClass(classScope, student.classId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(student);
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /students/:id/parents — admin/teacher (class-scoped) only. Supports a
// teacher starting a parent-teacher conversation about this student without
// already knowing the parent's account.
router.get("/students/:id/parents", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;

      const [student] = await db
        .select({ classId: studentsTable.classId })
        .from(studentsTable)
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(eq(studentsTable.id, id), eq(classesTable.schoolId, schoolId)))
        .limit(1);
      if (!student) { res.status(404).json({ error: "Not found" }); return; }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, student.classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const parents = await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
        .from(parentStudentsTable)
        .innerJoin(usersTable, eq(parentStudentsTable.parentId, usersTable.id))
        .where(eq(parentStudentsTable.studentId, id));

      res.json(parents);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /students/:id/summary — dashboard card data for a single student:
// attendance rate, pending fees, recent marks, and upcoming exams for their
// class. Available to the student themselves, their linked parent(s), and
// staff (admin/teacher) for any student in the school.
router.get("/students/:id/summary", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;

    const scope = await getStudentAccessScope(authUserId);
    if (!canAccessStudent(scope, id)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const student = await getStudentWithRelations(id, schoolId);
    if (!student) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Same class-scope restriction as GET /students/:id -- otherwise a
    // teacher restricted to specific classes could bypass it just by
    // requesting the summary instead of the detail endpoint.
    const classScope = await getTeacherClassScope(authUserId);
    if (!canAccessClass(classScope, student.classId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const today = new Date().toISOString().split("T")[0] as string;

    const [attendanceStats, pendingFees, recentMarksRows, upcomingExamsRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          present: sql<number>`count(*) filter (where ${attendanceTable.status} = 'present')::int`,
          late: sql<number>`count(*) filter (where ${attendanceTable.status} = 'late')::int`,
        })
        .from(attendanceTable)
        .where(eq(attendanceTable.studentId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(feePaymentsTable)
        .where(and(eq(feePaymentsTable.studentId, id), eq(feePaymentsTable.status, "pending"))),
      db
        .select({
          marksObtained: marksTable.marksObtained,
          exam: {
            id: examsTable.id,
            name: examsTable.name,
            subject: examsTable.subject,
            date: examsTable.date,
            maxMarks: examsTable.maxMarks,
          },
        })
        .from(marksTable)
        .innerJoin(examsTable, eq(marksTable.examId, examsTable.id))
        .where(eq(marksTable.studentId, id))
        .orderBy(desc(examsTable.date))
        .limit(5),
      db
        .select({ id: examsTable.id, name: examsTable.name, subject: examsTable.subject, date: examsTable.date })
        .from(examsTable)
        .where(and(eq(examsTable.classId, student.classId), gte(examsTable.date, today)))
        .orderBy(asc(examsTable.date))
        .limit(5),
    ]);

    const { total, present, late } = attendanceStats[0] ?? { total: 0, present: 0, late: 0 };
    const recentMarks = recentMarksRows.map((row) => {
      const marksObtained = parseFloat(row.marksObtained as string);
      return {
        exam: row.exam,
        marksObtained,
        percentage: row.exam?.maxMarks ? Math.round((marksObtained / row.exam.maxMarks) * 100 * 10) / 10 : 0,
      };
    });

    res.json({
      attendance: {
        total,
        present,
        // "Late" still means they showed up, so it counts toward the rate.
        attendanceRate: total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
      },
      fees: { pending: pendingFees[0]?.count ?? 0 },
      recentMarks,
      upcomingExams: upcomingExamsRows,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
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
