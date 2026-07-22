import { pgTable, serial, text, integer, date, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { schoolsTable } from "./schools";
import { usersTable } from "./users";
import { studentsTable } from "./students";

export const homeworkTable = pgTable("homework", {
  id: serial("id").primaryKey(),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  attachmentUrl: text("attachment_url"),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A student marking their own homework as done. One row per (homework, student).
export const homeworkCompletionsTable = pgTable(
  "homework_completions",
  {
    id: serial("id").primaryKey(),
    homeworkId: integer("homework_id")
      .notNull()
      .references(() => homeworkTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
    // A photo of the completed work, uploaded from the browser directly to
    // Cloudinary (see lib/upload-image.ts) -- optional, since some homework
    // doesn't produce a physical artifact worth photographing.
    submissionUrl: text("submission_url"),
  },
  (t) => [unique().on(t.homeworkId, t.studentId)]
);

export const insertHomeworkSchema = createInsertSchema(homeworkTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHomework = z.infer<typeof insertHomeworkSchema>;
export type Homework = typeof homeworkTable.$inferSelect;
export type HomeworkCompletion = typeof homeworkCompletionsTable.$inferSelect;
