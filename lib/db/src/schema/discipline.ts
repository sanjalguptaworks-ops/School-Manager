import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { schoolsTable } from "./schools";
import { usersTable } from "./users";

// A behavior/discipline incident logged against a student. Visible to
// admin/teacher (scoped to their classes) and the student's linked
// parent(s) -- deliberately not shown to the student themselves, matching
// the discretion most schools apply to conduct records.
export const disciplineIncidentsTable = pgTable("discipline_incidents", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity", { enum: ["minor", "moderate", "severe"] }).notNull().default("minor"),
  reportedBy: integer("reported_by").references(() => usersTable.id, { onDelete: "set null" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDisciplineIncidentSchema = createInsertSchema(disciplineIncidentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDisciplineIncident = z.infer<typeof insertDisciplineIncidentSchema>;
export type DisciplineIncident = typeof disciplineIncidentsTable.$inferSelect;
