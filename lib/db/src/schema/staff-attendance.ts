import { pgTable, serial, integer, date, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { usersTable } from "./users";
import { schoolsTable } from "./schools";

// Mirrors attendanceTable's shape, but for teachers rather than students --
// teachersTable has no schoolId of its own (it hangs off usersTable), so
// schoolId is stored directly here for query scoping, same as
// notificationsTable.
export const staffAttendanceTable = pgTable(
  "staff_attendance",
  {
    id: serial("id").primaryKey(),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => teachersTable.id, { onDelete: "cascade" }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status", { enum: ["present", "absent", "late"] }).notNull(),
    markedBy: integer("marked_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
  },
  (t) => [unique().on(t.teacherId, t.date)],
);

export const insertStaffAttendanceSchema = createInsertSchema(staffAttendanceTable).omit({
  id: true,
});
export type InsertStaffAttendance = z.infer<typeof insertStaffAttendanceSchema>;
export type StaffAttendance = typeof staffAttendanceTable.$inferSelect;
