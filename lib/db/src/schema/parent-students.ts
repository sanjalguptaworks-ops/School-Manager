import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const parentStudentsTable = pgTable(
  "parent_students",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.parentId, t.studentId)],
);

export type ParentStudent = typeof parentStudentsTable.$inferSelect;
