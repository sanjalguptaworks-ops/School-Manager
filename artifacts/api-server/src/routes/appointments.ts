import { Router } from "express";
import { db, appointmentsTable, usersTable, studentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";
import { notifyAppointmentRequested, notifyAppointmentStatusChanged } from "../lib/notify";

const router = Router();

function selectFields() {
  return {
    id: appointmentsTable.id,
    parentId: appointmentsTable.parentId,
    teacherId: appointmentsTable.teacherId,
    studentId: appointmentsTable.studentId,
    subject: appointmentsTable.subject,
    reason: appointmentsTable.reason,
    scheduledAt: appointmentsTable.scheduledAt,
    status: appointmentsTable.status,
    createdAt: appointmentsTable.createdAt,
  };
}

// GET /appointments — admin sees every appointment in the school; a parent
// sees their own requests; a teacher sees requests addressed to them.
router.get("/appointments", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

    const filters: any[] = [eq(appointmentsTable.schoolId, schoolId)];
    if (user?.role === "parent") filters.push(eq(appointmentsTable.parentId, authUserId));
    else if (user?.role === "teacher") filters.push(eq(appointmentsTable.teacherId, authUserId));
    else if (user?.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

    const parentUsers = db.select().from(usersTable).as("parent_users");
    const teacherUsers = db.select().from(usersTable).as("teacher_users");

    const rows = await db
      .select({
        ...selectFields(),
        parent: { id: parentUsers.id, name: parentUsers.name },
        teacher: { id: teacherUsers.id, name: teacherUsers.name },
        student: { id: studentsTable.id, rollNo: studentsTable.rollNo },
      })
      .from(appointmentsTable)
      .innerJoin(parentUsers, eq(appointmentsTable.parentId, parentUsers.id))
      .innerJoin(teacherUsers, eq(appointmentsTable.teacherId, teacherUsers.id))
      .innerJoin(studentsTable, eq(appointmentsTable.studentId, studentsTable.id))
      .where(and(...filters))
      .orderBy(desc(appointmentsTable.scheduledAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /appointments — parent only, requests a meeting about their own child.
router.post("/appointments", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["parent"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { teacherId, studentId, subject, reason, scheduledAt } = req.body;

      if (!teacherId || !studentId || !subject?.trim() || !scheduledAt) {
        res.status(400).json({ error: "teacherId, studentId, subject and scheduledAt are required" });
        return;
      }

      const scope = await getStudentAccessScope(authUserId);
      if (!canAccessStudent(scope, studentId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [teacher] = await db
        .select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(and(eq(usersTable.id, teacherId), eq(usersTable.role, "teacher"), eq(usersTable.schoolId, schoolId)))
        .limit(1);
      if (!teacher) { res.status(400).json({ error: "Invalid teacherId" }); return; }

      const [parent] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

      const [appointment] = await db
        .insert(appointmentsTable)
        .values({ parentId: authUserId, teacherId, studentId, subject: subject.trim(), reason: reason?.trim() || null, scheduledAt: new Date(scheduledAt), schoolId })
        .returning();

      notifyAppointmentRequested(
        { teacherId, parentName: parent?.name ?? "A parent", subject: appointment.subject, scheduledAt: appointment.scheduledAt },
        schoolId,
      );

      res.status(201).json(appointment);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// PATCH /appointments/:id — the assigned teacher confirms or cancels; the
// requesting parent or an admin can also cancel.
router.patch("/appointments/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { status } = req.body;

    if (status !== "confirmed" && status !== "cancelled") {
      res.status(400).json({ error: "status must be 'confirmed' or 'cancelled'" });
      return;
    }

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);

    const [existing] = await db
      .select()
      .from(appointmentsTable)
      .where(and(eq(appointmentsTable.id, id), eq(appointmentsTable.schoolId, schoolId)))
      .limit(1);
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    if (existing.status !== "pending") { res.status(400).json({ error: "This appointment has already been reviewed" }); return; }

    const isAssignedTeacher = user?.role === "teacher" && existing.teacherId === authUserId;
    const isRequestingParent = user?.role === "parent" && existing.parentId === authUserId;
    if (user?.role !== "admin" && !isAssignedTeacher && !(isRequestingParent && status === "cancelled")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [updated] = await db
      .update(appointmentsTable)
      .set({ status })
      .where(eq(appointmentsTable.id, id))
      .returning();

    if (updated && updated.parentId !== authUserId) {
      notifyAppointmentStatusChanged(
        { parentId: updated.parentId, status: updated.status as "confirmed" | "cancelled", subject: updated.subject, scheduledAt: updated.scheduledAt },
        schoolId,
      );
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
