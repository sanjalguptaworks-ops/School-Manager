import { Router } from "express";
import {
  db,
  galleryAlbumsTable,
  galleryPhotosTable,
  studentsTable,
  parentStudentsTable,
  usersTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import { getTeacherClassScope, canAccessClass } from "../lib/teacher-access";
import { notifyNewGalleryAlbum } from "../lib/notify";

const router = Router();

// GET /galleries — admin sees everything in the school; teachers are scoped
// to their assigned classes (or everything, if unassigned); students see
// their own class + whole-school albums; parents see a specific child's
// class via ?studentId=, same convention as GET /homework.
router.get("/galleries", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const { classId, studentId } = req.query as Record<string, string>;

    const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
    const role = user?.role;

    const filters: any[] = [eq(galleryAlbumsTable.schoolId, schoolId)];

    if (role === "student") {
      const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
      if (!s) { res.json([]); return; }
      filters.push(sql`(${galleryAlbumsTable.classId} = ${s.classId} or ${galleryAlbumsTable.classId} is null)`);
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
        filters.push(sql`(${galleryAlbumsTable.classId} = ${match.classId} or ${galleryAlbumsTable.classId} is null)`);
      } else {
        const classIds = children.map((c) => c.classId);
        filters.push(sql`(${galleryAlbumsTable.classId} in ${classIds} or ${galleryAlbumsTable.classId} is null)`);
      }
    } else if (role === "teacher") {
      const classScope = await getTeacherClassScope(authUserId);
      if (classId && !canAccessClass(classScope, parseInt(classId))) { res.status(403).json({ error: "Forbidden" }); return; }
      if (classId) filters.push(sql`(${galleryAlbumsTable.classId} = ${parseInt(classId)} or ${galleryAlbumsTable.classId} is null)`);
      else if (classScope.kind === "restricted") {
        if (classScope.classIds.length === 0) filters.push(sql`${galleryAlbumsTable.classId} is null`);
        else filters.push(sql`(${galleryAlbumsTable.classId} in ${classScope.classIds} or ${galleryAlbumsTable.classId} is null)`);
      }
    } else {
      // admin
      if (classId) filters.push(sql`(${galleryAlbumsTable.classId} = ${parseInt(classId)} or ${galleryAlbumsTable.classId} is null)`);
    }

    const rows = await db
      .select({
        id: galleryAlbumsTable.id,
        title: galleryAlbumsTable.title,
        albumDate: galleryAlbumsTable.albumDate,
        classId: galleryAlbumsTable.classId,
        createdBy: galleryAlbumsTable.createdBy,
        createdAt: galleryAlbumsTable.createdAt,
        // gallery_photos has its own `id` column, so a bare interpolated
        // reference to the outer gallery_albums.id would silently resolve
        // against gallery_photos.id instead of correlating to the outer row
        // -- spelling out the outer table's real name avoids that ambiguity.
        photoCount: sql<number>`(select count(*)::int from gallery_photos gp where gp.album_id = gallery_albums.id)`,
        coverPhotoUrl: sql<string | null>`(select gp.image_url from gallery_photos gp where gp.album_id = gallery_albums.id order by gp.created_at asc limit 1)`,
      })
      .from(galleryAlbumsTable)
      .where(and(...filters))
      .orderBy(desc(galleryAlbumsTable.albumDate));

    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /galleries — admin or teacher
router.post("/galleries", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;
      const { title, albumDate, classId, imageUrls } = req.body;
      if (!title?.trim() || !albumDate) {
        res.status(400).json({ error: "title and albumDate are required" });
        return;
      }

      if (classId) {
        const classScope = await getTeacherClassScope(authUserId);
        if (!canAccessClass(classScope, classId)) { res.status(403).json({ error: "Forbidden" }); return; }
      }

      const [album] = await db
        .insert(galleryAlbumsTable)
        .values({ title, albumDate, classId: classId || null, schoolId, createdBy: authUserId || null })
        .returning();

      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        await db.insert(galleryPhotosTable).values(imageUrls.map((imageUrl: string) => ({ albumId: album.id, imageUrl })));
      }

      notifyNewGalleryAlbum({ title: album.title, classId: album.classId }, schoolId);

      res.status(201).json({ ...album, photoCount: imageUrls?.length ?? 0, coverPhotoUrl: imageUrls?.[0] ?? null });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// GET /galleries/:id — any authenticated user in the school; access is
// enforced by re-running the same class-scope filter used by the list
// endpoint rather than duplicating role logic ad hoc.
router.get("/galleries/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  try {
    const schoolId = (req as any).schoolId;
    const authUserId = (req as any).authUserId;
    const id = parseInt(req.params["id"] as string);

    const [album] = await db
      .select()
      .from(galleryAlbumsTable)
      .where(and(eq(galleryAlbumsTable.id, id), eq(galleryAlbumsTable.schoolId, schoolId)))
      .limit(1);
    if (!album) { res.status(404).json({ error: "Not found" }); return; }

    if (album.classId) {
      const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
      if (user?.role === "student") {
        const [s] = await db.select({ classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.userId, authUserId)).limit(1);
        if (s?.classId !== album.classId) { res.status(403).json({ error: "Forbidden" }); return; }
      } else if (user?.role === "parent") {
        const children = await db
          .select({ classId: studentsTable.classId })
          .from(parentStudentsTable)
          .innerJoin(studentsTable, eq(parentStudentsTable.studentId, studentsTable.id))
          .where(eq(parentStudentsTable.parentId, authUserId));
        if (!children.some((c) => c.classId === album.classId)) { res.status(403).json({ error: "Forbidden" }); return; }
      } else if (user?.role === "teacher") {
        const classScope = await getTeacherClassScope(authUserId);
        if (!canAccessClass(classScope, album.classId)) { res.status(403).json({ error: "Forbidden" }); return; }
      }
    }

    const photos = await db
      .select()
      .from(galleryPhotosTable)
      .where(eq(galleryPhotosTable.albumId, id))
      .orderBy(galleryPhotosTable.createdAt);

    res.json({ ...album, photos, photoCount: photos.length, coverPhotoUrl: photos[0]?.imageUrl ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /galleries/:id/photos — admin or teacher
router.post("/galleries/:id/photos", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params["id"] as string);
      const { imageUrls } = req.body;
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
        res.status(400).json({ error: "imageUrls (non-empty array) required" });
        return;
      }

      const [album] = await db
        .select({ id: galleryAlbumsTable.id })
        .from(galleryAlbumsTable)
        .where(and(eq(galleryAlbumsTable.id, id), eq(galleryAlbumsTable.schoolId, schoolId)))
        .limit(1);
      if (!album) { res.status(404).json({ error: "Not found" }); return; }

      const photos = await db
        .insert(galleryPhotosTable)
        .values(imageUrls.map((imageUrl: string) => ({ albumId: id, imageUrl })))
        .returning();

      res.status(201).json(photos);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /galleries/:id/photos/:photoId — admin or teacher
router.delete("/galleries/:id/photos/:photoId", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const id = parseInt(req.params["id"] as string);
      const photoId = parseInt(req.params["photoId"] as string);

      const [album] = await db
        .select({ id: galleryAlbumsTable.id })
        .from(galleryAlbumsTable)
        .where(and(eq(galleryAlbumsTable.id, id), eq(galleryAlbumsTable.schoolId, schoolId)))
        .limit(1);
      if (!album) { res.status(404).json({ error: "Not found" }); return; }

      const [deleted] = await db
        .delete(galleryPhotosTable)
        .where(and(eq(galleryPhotosTable.id, photoId), eq(galleryPhotosTable.albumId, id)))
        .returning();
      if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// DELETE /galleries/:id — admin or teacher
router.delete("/galleries/:id", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const schoolId = (req as any).schoolId;
      const [deleted] = await db
        .delete(galleryAlbumsTable)
        .where(and(eq(galleryAlbumsTable.id, id), eq(galleryAlbumsTable.schoolId, schoolId)))
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
