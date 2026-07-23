import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { studentsTable } from "./students";
import { schoolsTable } from "./schools";

// A parent requesting a meeting with a teacher about a specific child --
// distinct from the open-ended messagesTable conversations, since this has
// its own scheduling + status lifecycle instead of a message thread.
export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  reason: text("reason"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["pending", "confirmed", "cancelled"] }).notNull().default("pending"),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({
  id: true,
  status: true,
  createdAt: true,
});
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
