import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { teachersTable } from "./teachers";
import { classesTable } from "./classes";

// Which classes a teacher is assigned to. A teacher with zero rows here is
// treated as unrestricted (sees every class in the school, same as today) --
// see lib/teacher-access.ts. Once assigned to at least one class, they're
// scoped to just those.
export const teacherClassesTable = pgTable(
  "teacher_classes",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    classId: integer("class_id")
      .notNull()
      .references(() => classesTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.teacherId, t.classId)],
);

export type TeacherClass = typeof teacherClassesTable.$inferSelect;
