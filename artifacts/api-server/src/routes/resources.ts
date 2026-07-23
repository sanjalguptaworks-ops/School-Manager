import { Router } from "express";
import { db, resourcesTable, usersTable, studentsTable, parentStudentsTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";
import { notifyNewResource } from "../lib/notify";

const router = Router();

// GET /resources — same class-scoping convention as /homework and /galleries.
router.get("/resources", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId, studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;

    const filters: any[] = [eq(resourcesTable.schoolId, schoolId)];

    if (role === "student") {
      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
      if (!s) { res.json([]); return; }
      filters.push(eq(resourcesTable.classId, s.classId));
    } else if (role === "parent") {
      const children = await db
        .select({ studentId: parentStudentsTable.studentId, classId: studentsTable.classId })
        .from(parentStudentsTable)
        .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
        .where(eq(parentStudentsTable.parentId, authUserId));
      if (children.length === 0) { res.json([]); return; }

      if (studentId) {
        const match = children.find((c) => c.studentId === parseInt(studentId));
        if (!match) { res.status(403).json({ error: "Forbidden" }); return; }
        filters.push(eq(resourcesTable.classId, match.classId));
      } else {
        filters.push(inArray(resourcesTable.classId, children.map((c) => c.classId)));
      }
    } else if (role === "teacher") {
      const classScope = await getTeacherClassScope(authUserId);
      if (classId && !canAccessClass(classScope, parseInt(classId))) { res.status(403).json({ error: "Forbidden" }); return; }
      if (classId) filters.push(eq(resourcesTable.classId, parseInt(classId)));
      else if (classScope.kind === "restricted") {
        if (classScope.classIds.length === 0) { res.json([]); return; }
        filters.push(inArray(resourcesTable.classId, classScope.classIds));
      }
    } else {
      // admin
      if (classId) filters.push(eq(resourcesTable.classId, parseInt(classId)));
    }

    const rows = await db
      .select()
      .from(resourcesTable)
      .where(and(...filters))
      .orderBy(desc(resourcesTable.createdAt))
      .limit(50);

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /resources — admin or teacher
router.post("/resources", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { title, groupName, body, attachmentUrl, classId } = req.body;
      if (!title?.trim() || !body?.trim() || !classId) {
        res.status(400).json({ error: "title, body and classId are required" });
        return;
      }

      const classScope = await getTeacherClassScope(authUserId);
      if (!canAccessClass(classScope, classId)) { res.status(403).json({ error: "Forbidden" }); return; }

      const [resource] = await db
        .insert(resourcesTable)
        .values({
          title: title.trim(),
          groupName: groupName?.trim() || "Daily Updates",
          body: body.trim(),
          attachmentUrl: attachmentUrl?.trim() || null,
          classId,
          schoolId,
          createdBy: authUserId || null,
        })
        .returning();

      notifyNewResource({ title: resource.title, classId: resource.classId }, schoolId);

      res.status(201).json(resource);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /resources/:id — admin or teacher
router.delete("/resources/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [deleted] = await db
        .delete(resourcesTable)
        .where(and(eq(resourcesTable.id, id), eq(resourcesTable.schoolId, schoolId)))
        .returning();
      if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
