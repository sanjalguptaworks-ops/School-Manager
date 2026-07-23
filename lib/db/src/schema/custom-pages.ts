import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { schoolsTable } from "./schools";

// Admin-authored static content (Food Menu, Holiday List, Family Letter --
// the kind of thing that changes rarely and isn't tied to a specific class
// or date the way notices/events are).
export const customPagesTable = pgTable("custom_pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customPageAttachmentsTable = pgTable("custom_page_attachments", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id")
    .notNull()
    .references(() => customPagesTable.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomPageSchema = createInsertSchema(customPagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomPage = z.infer<typeof insertCustomPageSchema>;
export type CustomPage = typeof customPagesTable.$inferSelect;

export const insertCustomPageAttachmentSchema = createInsertSchema(customPageAttachmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCustomPageAttachment = z.infer<typeof insertCustomPageAttachmentSchema>;
export type CustomPageAttachment = typeof customPageAttachmentsTable.$inferSelect;
