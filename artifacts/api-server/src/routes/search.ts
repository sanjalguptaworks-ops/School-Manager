import { Router } from "express";
import { db, usersTable, studentsTable, classesTable, teachersTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";

const router = Router();

interface SearchResult {
  type: "student" | "teacher" | "class";
  label: string;
  sublabel: string;
  link: string;
}

const RESULT_LIMIT = 8;

// GET /search?q= — admin/teacher only. Flat, cross-entity search across
// students, teachers, and classes for the top-bar search box.
router.get("/search", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin", "teacher"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const q = (req.query["q"] as string | undefined)?.trim();
      if (!q || q.length < 2) {
        res.json([]);
        return;
      }
      const pattern = `%${q}%`;

      const studentRows = await db
        .select({
          id: studentsTable.id,
          name: usersTable.name,
          rollNo: studentsTable.rollNo,
          className: classesTable.name,
          section: classesTable.section,
        })
        .from(studentsTable)
        .innerJoin(usersTable, eq(studentsTable.userId, usersTable.id))
        .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(and(eq(usersTable.schoolId, schoolId), or(ilike(usersTable.name, pattern), ilike(studentsTable.rollNo, pattern))))
        .limit(RESULT_LIMIT);

      const teacherRows = await db
        .select({ id: teachersTable.id, name: usersTable.name, email: usersTable.email })
        .from(teachersTable)
        .innerJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(and(eq(usersTable.schoolId, schoolId), ilike(usersTable.name, pattern)))
        .limit(RESULT_LIMIT);

      const classRows = await db
        .select({ id: classesTable.id, name: classesTable.name, section: classesTable.section })
        .from(classesTable)
        .where(and(eq(classesTable.schoolId, schoolId), ilike(classesTable.name, pattern)))
        .limit(RESULT_LIMIT);

      const results: SearchResult[] = [
        ...studentRows.map((s) => ({
          type: "student" as const,
          label: s.name,
          sublabel: `Student · Roll ${s.rollNo} · ${s.className} ${s.section}`,
          link: `/students/${s.id}`,
        })),
        ...teacherRows.map((t) => ({
          type: "teacher" as const,
          label: t.name,
          sublabel: `Teacher · ${t.email}`,
          link: `/teachers/${t.id}`,
        })),
        ...classRows.map((c) => ({
          type: "class" as const,
          label: `${c.name} ${c.section}`,
          sublabel: "Class",
          link: `/classes/${c.id}`,
        })),
      ];

      res.json(results);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export default router;
