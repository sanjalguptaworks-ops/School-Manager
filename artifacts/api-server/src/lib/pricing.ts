import { db, pricingTiersTable, type PricingTier } from "@workspace/db";
import { asc } from "drizzle-orm";

const DEFAULT_ANNUAL_DISCOUNT_PERCENT = 15;
const DEFAULT_GST_PERCENT = 18;

function getAnnualDiscountPercent(): number {
  const raw = process.env["ANNUAL_DISCOUNT_PERCENT"];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_ANNUAL_DISCOUNT_PERCENT;
}

function getGstPercent(): number {
  const raw = process.env["GST_PERCENT"];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : DEFAULT_GST_PERCENT;
}

/**
 * Finds the pricing tier matching a student count. Tiers are ordered by
 * minStudents; a null maxStudents means "open-ended" (the top tier). Falls
 * back to the highest-priced tier if the count somehow exceeds every
 * bounded tier and there's no open-ended one configured (shouldn't happen
 * once the creator has set up tiers properly, but keeps this from throwing).
 */
export async function getTierForStudentCount(studentCount: number): Promise<PricingTier | null> {
  const tiers = await db.select().from(pricingTiersTable).orderBy(asc(pricingTiersTable.minStudents));
  if (tiers.length === 0) return null;

  const match = tiers.find(
    (t) => studentCount >= t.minStudents && (t.maxStudents === null || studentCount <= t.maxStudents),
  );
  return match || tiers[tiers.length - 1];
}

export interface ComputedAmount {
  subtotalRupees: number;
  taxPercent: number;
  totalRupees: number;
}

/**
 * tierMonthlyPriceRupees -> (x12 minus annual discount, if annual) -> minus
 * the school's own discount% -> plus GST. All rupee amounts are rounded to
 * the nearest whole rupee.
 */
export function computeAmount(params: {
  tierMonthlyPriceRupees: number;
  interval: "monthly" | "annual";
  discountPercent: number;
}): ComputedAmount {
  let base = params.tierMonthlyPriceRupees;
  if (params.interval === "annual") {
    base = base * 12 * (1 - getAnnualDiscountPercent() / 100);
  }
  const subtotalRupees = Math.round(base * (1 - params.discountPercent / 100));
  const taxPercent = getGstPercent();
  const totalRupees = Math.round(subtotalRupees * (1 + taxPercent / 100));
  return { subtotalRupees, taxPercent, totalRupees };
}
