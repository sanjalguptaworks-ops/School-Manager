import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Creator-managed flat-price bands by student count, e.g. 0-500 = ₹5,000/mo,
// 500-1,000 = ₹10,000/mo. maxStudents null means "open-ended" (the top tier).
export const pricingTiersTable = pgTable("pricing_tiers", {
  id: serial("id").primaryKey(),
  minStudents: integer("min_students").notNull(),
  maxStudents: integer("max_students"),
  monthlyPriceRupees: integer("monthly_price_rupees").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPricingTierSchema = createInsertSchema(pricingTiersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPricingTier = z.infer<typeof insertPricingTierSchema>;
export type PricingTier = typeof pricingTiersTable.$inferSelect;
