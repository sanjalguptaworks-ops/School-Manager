import { pgTable, serial, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cache of Razorpay Plans we've created for the optional auto-pay path,
// keyed by (interval, tierMinStudents, amountPaise) -- amountPaise is the
// already-discounted+taxed flat price, so two schools in the same tier with
// different per-school discounts correctly get their own cached Plan.
export const billingPlansTable = pgTable(
  "billing_plans",
  {
    id: serial("id").primaryKey(),
    interval: text("interval", { enum: ["monthly", "annual"] }).notNull(),
    tierMinStudents: integer("tier_min_students").notNull(),
    razorpayPlanId: text("razorpay_plan_id").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.interval, t.tierMinStudents, t.amountPaise)],
);

export const insertBillingPlanSchema = createInsertSchema(billingPlansTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBillingPlan = z.infer<typeof insertBillingPlanSchema>;
export type BillingPlan = typeof billingPlansTable.$inferSelect;
