import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { classesTable } from "./classes";
import { schoolsTable } from "./schools";

// A teacher's plan for one class/subject/date -- staff-only (teachers +
// admin), never shown to students/parents, unlike homework/resources.
export const lessonPlansTable = pgTable("lesson_plans", {
  id: serial("id").primaryKey(),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  planDate: date("plan_date", { mode: "string" }).notNull(),
  topic: text("topic").notNull(),
  content: text("content").notNull(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLessonPlanSchema = createInsertSchema(lessonPlansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLessonPlan = z.infer<typeof insertLessonPlanSchema>;
export type LessonPlan = typeof lessonPlansTable.$inferSelect;
