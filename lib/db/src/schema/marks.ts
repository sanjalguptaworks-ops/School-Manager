import { pgTable, serial, integer, numeric, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { examsTable } from "./exams";
import { studentsTable } from "./students";

export const marksTable = pgTable(
  "marks",
  {
    id: serial("id").primaryKey(),
    examId: integer("exam_id")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    marksObtained: numeric("marks_obtained", { precision: 6, scale: 2 }).notNull(),
  },
  (t) => [unique().on(t.examId, t.studentId)],
);

export const insertMarkSchema = createInsertSchema(marksTable).omit({
  id: true,
});
export type InsertMark = z.infer<typeof insertMarkSchema>;
export type Mark = typeof marksTable.$inferSelect;
