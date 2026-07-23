import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { classesTable } from "./classes";
import { schoolsTable } from "./schools";

// A structured daily/periodic class update from a teacher (what the class
// sang, did, learned, homework assigned, etc.) -- distinct from notices
// (one-way school-wide announcements) and homework (a trackable assignment
// with per-student completion). groupName is a free-text label the teacher
// picks (e.g. "Daily Updates", "Important Communication") purely for
// display grouping, not a separate table.
export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  groupName: text("group_name").notNull().default("Daily Updates"),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResourceSchema = createInsertSchema(resourcesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resourcesTable.$inferSelect;
