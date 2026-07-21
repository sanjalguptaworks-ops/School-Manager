import { db, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface SuspensionWindow {
  suspendedFrom: string | null;
  suspendedUntil: string | null;
}

/**
 * True when today falls inside the school's scheduled suspension window.
 * Checked lazily on every login and every school-scoped request -- no
 * background job needed, and it clears itself automatically once today
 * passes suspendedUntil.
 */
export function isSchoolSuspended(school: SuspensionWindow): boolean {
  if (!school.suspendedFrom) return false;
  const today = new Date().toISOString().split("T")[0] as string;
  if (today < school.suspendedFrom) return false;
  if (school.suspendedUntil && today > school.suspendedUntil) return false;
  return true;
}

export interface BillingWindow {
  billingMode: "trial" | "manual" | "auto";
  paidUntil: string | null;
}

/**
 * True once a school's trial or last-paid period has lapsed without a new
 * payment. Auto-pay schools are exempt -- their access is governed by the
 * Razorpay subscription webhook instead (see routes/billing.ts), not this
 * date field.
 */
export function isBillingLapsed(school: BillingWindow): boolean {
  if (school.billingMode === "auto") return false;
  if (!school.paidUntil) return false;
  const today = new Date().toISOString().split("T")[0] as string;
  return today > school.paidUntil;
}

/**
 * Whether the given school has opted in to sending email (welcome emails,
 * notice/exam/fee-due notifications). Defaults to true if the school row
 * can't be found, matching the column's own default.
 */
export async function isEmailEnabledForSchool(schoolId: number): Promise<boolean> {
  const [school] = await db
    .select({ emailEnabled: schoolsTable.emailEnabled })
    .from(schoolsTable)
    .where(eq(schoolsTable.id, schoolId))
    .limit(1);
  return school?.emailEnabled ?? true;
}
