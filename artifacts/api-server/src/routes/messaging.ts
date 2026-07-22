import { Router } from "express";
import { db, conversationsTable, messagesTable, usersTable, studentsTable, parentStudentsTable } from "@workspace/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireAuth, requireSchool } from "../middlewares/auth";
import { getStudentAccessScope, canAccessStudent } from "../lib/student-access";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";
import { notifyNewMessage } from "../lib/notify";

const router = Router();

async function getRole(authUserId: number): Promise<string | undefined> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
  return user?.role;
}

// GET /conversations — teacher/parent see their own threads; admin sees
// every thread in the school (read-only oversight).
router.get("/conversations", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const role = await getRole(authUserId);

    const filters: any[] = [eq(conversationsTable.schoolId, schoolId)];
    if (role === "teacher") filters.push(eq(conversationsTable.teacherId, authUserId));
    else if (role === "parent") filters.push(eq(conversationsTable.parentId, authUserId));
    else if (role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

    const teacherUsers = db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).as("teacher_users");
    const parentUsers = db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).as("parent_users");

    const rows = await db
      .select({
        id: conversationsTable.id,
        teacherId: conversationsTable.teacherId,
        parentId: conversationsTable.parentId,
        studentId: conversationsTable.studentId,
        teacherLastReadAt: conversationsTable.teacherLastReadAt,
        parentLastReadAt: conversationsTable.parentLastReadAt,
        teacherName: teacherUsers.name,
        parentName: parentUsers.name,
        studentName: sql<string>`(select ${usersTable.name} from ${studentsTable} inner join ${usersTable} on ${usersTable.id} = ${studentsTable.userId} where ${studentsTable.id} = ${conversationsTable.studentId})`,
        lastMessageBody: sql<string | null>`(select ${messagesTable.body} from ${messagesTable} where ${messagesTable.conversationId} = ${conversationsTable.id} order by ${messagesTable.createdAt} desc limit 1)`,
        lastMessageAt: sql<string | null>`(select ${messagesTable.createdAt} from ${messagesTable} where ${messagesTable.conversationId} = ${conversationsTable.id} order by ${messagesTable.createdAt} desc limit 1)`,
        unreadCount:
          role === "teacher"
            ? sql<number>`(select count(*)::int from ${messagesTable} where ${messagesTable.conversationId} = ${conversationsTable.id} and ${messagesTable.senderId} != ${authUserId} and (${conversationsTable.teacherLastReadAt} is null or ${messagesTable.createdAt} > ${conversationsTable.teacherLastReadAt}))`
            : role === "parent"
              ? sql<number>`(select count(*)::int from ${messagesTable} where ${messagesTable.conversationId} = ${conversationsTable.id} and ${messagesTable.senderId} != ${authUserId} and (${conversationsTable.parentLastReadAt} is null or ${messagesTable.createdAt} > ${conversationsTable.parentLastReadAt}))`
              : sql<number>`0`,
      })
      .from(conversationsTable)
      .innerJoin(teacherUsers, eq(conversationsTable.teacherId, teacherUsers.id))
      .innerJoin(parentUsers, eq(conversationsTable.parentId, parentUsers.id))
      .where(and(...filters))
      .orderBy(desc(conversationsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /conversations — parent starts one with a teacher about their own
// child, or a teacher starts one with a parent about a student in their
// class scope. Idempotent: returns the existing thread if one already
// exists for this (teacher, parent, student) trio.
router.post("/conversations", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const role = await getRole(authUserId);
    const { studentId } = req.body;

    if (!studentId) { res.status(400).json({ error: "studentId is required" }); return; }

    let teacherId: number;
    let parentId: number;

    if (role === "parent") {
      const { teacherUserId } = req.body;
      if (!teacherUserId) { res.status(400).json({ error: "teacherUserId is required" }); return; }

      const scope = await getStudentAccessScope(authUserId);
      if (!canAccessStudent(scope, studentId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [teacher] = await db.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, teacherUserId), eq(usersTable.role, "teacher"), eq(usersTable.schoolId, schoolId))).limit(1);
      if (!teacher) { res.status(400).json({ error: "Invalid teacherUserId" }); return; }

      teacherId = teacherUserId;
      parentId = authUserId;
    } else if (role === "teacher") {
      const { parentUserId } = req.body;
      if (!parentUserId) { res.status(400).json({ error: "parentUserId is required" }); return; }

      const [student] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
      if (!student) { res.status(400).json({ error: "Invalid studentId" }); return; }
      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, student.classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [link] = await db.select({ parentId: parentStudentsTable.parentId }).from(parentStudentsTable).where(and(eq(parentStudentsTable.parentId, parentUserId), eq(parentStudentsTable.studentId, studentId))).limit(1);
      if (!link) { res.status(400).json({ error: "That parent is not linked to this student" }); return; }

      teacherId = authUserId;
      parentId = parentUserId;
    } else {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [existing] = await db
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(and(eq(conversationsTable.teacherId, teacherId), eq(conversationsTable.parentId, parentId), eq(conversationsTable.studentId, studentId)))
      .limit(1);
    if (existing) { res.json(existing); return; }

    const [conversation] = await db.insert(conversationsTable).values({ teacherId, parentId, studentId, schoolId }).returning();
    res.status(201).json(conversation);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /conversations/:id/messages — participants only (or admin, read-only).
// Marks the caller's own lastReadAt, if they're an actual participant.
router.get("/conversations/:id/messages", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const role = await getRole(authUserId);

    const [conversation] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, id), eq(conversationsTable.schoolId, schoolId))).limit(1);
    if (!conversation) { res.status(404).json({ error: "Not found" }); return; }

    const isTeacher = conversation.teacherId === authUserId;
    const isParent = conversation.parentId === authUserId;
    if (!isTeacher && !isParent && role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }

    const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));

    if (isTeacher) await db.update(conversationsTable).set({ teacherLastReadAt: new Date() }).where(eq(conversationsTable.id, id));
    else if (isParent) await db.update(conversationsTable).set({ parentLastReadAt: new Date() }).where(eq(conversationsTable.id, id));

    res.json(messages);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /conversations/:id/messages — participants only (not admin --
// oversight shouldn't extend to impersonating either side of the thread).
router.post("/conversations/:id/messages", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string);
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { body } = req.body;

    if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

    const [conversation] = await db.select().from(conversationsTable).where(and(eq(conversationsTable.id, id), eq(conversationsTable.schoolId, schoolId))).limit(1);
    if (!conversation) { res.status(404).json({ error: "Not found" }); return; }

    const isTeacher = conversation.teacherId === authUserId;
    const isParent = conversation.parentId === authUserId;
    if (!isTeacher && !isParent) { res.status(403).json({ error: "Forbidden" }); return; }

    const [message] = await db.insert(messagesTable).values({ conversationId: id, senderId: authUserId, body: body.trim() }).returning();

    const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const recipientUserId = isTeacher ? conversation.parentId : conversation.teacherId;
    notifyNewMessage({ conversationId: id, recipientUserId, senderName: sender?.name ?? "Someone", body: body.trim() }, schoolId);

    res.status(201).json(message);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
