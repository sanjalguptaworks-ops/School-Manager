import { pgTable, serial, integer, text, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";

// An audit trail of every payment the creator has generated for a school --
// one row per billing period, whether or not it's been paid yet.
export const billingPaymentsTable = pgTable("billing_payments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  interval: text("interval", { enum: ["monthly", "annual"] }).notNull(),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  // Snapshots taken at generation time, so editing tiers/discounts later
  // never changes the amount on an already-generated payment.
  studentCountAtGeneration: integer("student_count_at_generation").notNull(),
  tierMonthlyPriceRupees: integer("tier_monthly_price_rupees").notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  subtotalRupees: integer("subtotal_rupees").notNull(),
  taxPercent: integer("tax_percent").notNull(),
  totalRupees: integer("total_rupees").notNull(),
  razorpayPaymentLinkId: text("razorpay_payment_link_id").notNull(),
  razorpayPaymentLinkUrl: text("razorpay_payment_link_url").notNull(),
  status: text("status", { enum: ["created", "paid", "expired", "cancelled"] })
    .notNull()
    .default("created"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export const insertBillingPaymentSchema = createInsertSchema(billingPaymentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBillingPayment = z.infer<typeof insertBillingPaymentSchema>;
export type BillingPayment = typeof billingPaymentsTable.$inferSelect;
