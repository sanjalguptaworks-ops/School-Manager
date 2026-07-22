import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { schoolsTable } from "./schools";
import { teachersTable } from "./teachers";

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

// One weekly-recurring period slot for a class. (classId, dayOfWeek,
// periodNumber) is unique -- setting a slot again just replaces what was
// there (admin editing the grid), rather than creating a duplicate.
export const timetableSlotsTable = pgTable(
  "timetable_slots",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classesTable.id, { onDelete: "cascade" }),
    dayOfWeek: text("day_of_week", { enum: WEEKDAYS }).notNull(),
    periodNumber: integer("period_number").notNull(),
    subject: text("subject").notNull(),
    teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.classId, t.dayOfWeek, t.periodNumber)],
);

export const insertTimetableSlotSchema = createInsertSchema(timetableSlotsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTimetableSlot = z.infer<typeof insertTimetableSlotSchema>;
export type TimetableSlot = typeof timetableSlotsTable.$inferSelect;
