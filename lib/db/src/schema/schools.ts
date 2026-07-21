import { pgTable, serial, text, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const schoolsTable = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  // Scheduled suspension window. If suspendedFrom is set and today falls
  // within [suspendedFrom, suspendedUntil] (or suspendedUntil is null,
  // meaning "indefinitely"), the school's users are blocked from logging in
  // and from every school-scoped API route. No background job needed --
  // this is checked lazily on each request/login, and clears itself once
  // today passes suspendedUntil.
  suspendedFrom: date("suspended_from", { mode: "string" }),
  suspendedUntil: date("suspended_until", { mode: "string" }),
  // Per-school toggle for whether the app is allowed to send email on this
  // school's behalf (welcome emails, notice/exam/fee-due notifications).
  emailEnabled: boolean("email_enabled").notNull().default(true),
  // Placeholder for a future SMS integration -- stored and shown in the
  // creator UI, but nothing currently sends SMS.
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schoolsTable.$inferSelect;
