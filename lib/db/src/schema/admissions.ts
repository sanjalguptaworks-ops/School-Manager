import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";

// A lightweight CRM-style tracker for prospective-family inquiries, logged
// manually by admin (phone call, in-person visit, email) -- not a
// public-facing self-service form, since that would need per-school public
// pages/slugs, a prerequisite this multi-tenant app doesn't have yet.
export const admissionInquiriesTable = pgTable("admission_inquiries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  desiredClass: text("desired_class"),
  message: text("message"),
  status: text("status", { enum: ["new", "contacted", "admitted", "rejected"] }).notNull().default("new"),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdmissionInquirySchema = createInsertSchema(admissionInquiriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdmissionInquiry = z.infer<typeof insertAdmissionInquirySchema>;
export type AdmissionInquiry = typeof admissionInquiriesTable.$inferSelect;
