import { pgTable, serial, text, timestamp, date, boolean, integer } from "drizzle-orm/pg-core";
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
  // School-uploaded branding, shown in place of the generic EduCore mark for
  // that school's own users. Only the creator sets this (see routes/schools.ts).
  logoUrl: text("logo_url"),
  // The school's own certificate background/design, uploaded by their admin
  // (see routes/schools.ts PATCH /schools/me). Certificates for this
  // school's students are rendered with this image behind the text.
  certificateTemplateUrl: text("certificate_template_url"),
  // Scheduled suspension window. If suspendedFrom is set and today falls
  // within [suspendedFrom, suspendedUntil] (or suspendedUntil is null,
  // meaning "indefinitely"), the school's users are blocked from logging in
  // and from every school-scoped API route. No background job needed --
  // this is checked lazily on each request/login, and clears itself once
  // today passes suspendedUntil.
  suspendedFrom: date("suspended_from", { mode: "string" }),
  suspendedUntil: date("suspended_until", { mode: "string" }),
  // Which side caused the current suspension -- lets the billing webhook
  // and the creator's manual suspend/clear coexist without clobbering each
  // other (the webhook only ever touches a suspension it caused, and never
  // touches one the creator set by hand, and vice versa).
  suspensionReason: text("suspension_reason", { enum: ["manual", "billing"] }),
  // Per-school toggle for whether the app is allowed to send email on this
  // school's behalf (welcome emails, notice/exam/fee-due notifications).
  emailEnabled: boolean("email_enabled").notNull().default(true),
  // Placeholder for a future SMS integration -- stored and shown in the
  // creator UI, but nothing currently sends SMS.
  smsEnabled: boolean("sms_enabled").notNull().default(false),
  // Subscription billing (Razorpay). trialDays is set per school by the
  // creator before the school's first checkout; billingInterval/discountPercent
  // determine which cached Plan (see billingPlansTable) gets used.
  razorpayCustomerId: text("razorpay_customer_id"),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  subscriptionStatus: text("subscription_status", {
    enum: ["none", "created", "trialing", "active", "halted", "cancelled"],
  })
    .notNull()
    .default("none"),
  trialDays: integer("trial_days"),
  discountPercent: integer("discount_percent").notNull().default(0),
  billingInterval: text("billing_interval", { enum: ["monthly", "annual"] }),
  // Creator-driven tiered billing. "trial" = still in the free trial window;
  // "manual" = billed via creator-generated Razorpay Payment Links;
  // "auto" = the school opted into a real recurring Razorpay Subscription
  // (flat tier price, see billingPlansTable) instead of manual payment links.
  billingMode: text("billing_mode", { enum: ["trial", "manual", "auto"] })
    .notNull()
    .default("trial"),
  // Set once when the creator approves the school; combined with trialDays
  // to compute the initial paidUntil.
  trialStartedAt: timestamp("trial_started_at", { withTimezone: true }),
  // Single source of truth for "this school has access through this date" --
  // covers the trial window, then each paid period as payments come in.
  // Checked lazily (like suspendedFrom/suspendedUntil above) rather than via
  // a background job: a school is blocked once today is past paidUntil and
  // billingMode isn't "auto" (auto-pay is gated by subscription status
  // instead, via the existing suspendedFrom/suspensionReason mechanism).
  paidUntil: date("paid_until", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSchoolSchema = createInsertSchema(schoolsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schoolsTable.$inferSelect;
