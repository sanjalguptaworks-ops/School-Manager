/**
 * Thin fetch-based client for Razorpay's Subscriptions API (same "raw HTTP,
 * no SDK" style already used for Resend in mailer.ts). Razorpay auth is
 * plain HTTP Basic Auth with key_id:key_secret, and webhook verification is
 * a plain HMAC-SHA256 check -- neither needs their Node SDK.
 */
import crypto from "crypto";
import { db, billingPlansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const BASE_URL = "https://api.razorpay.com/v1";

// Razorpay subscriptions require a finite total_count of billing cycles --
// there's no "forever" option. These are just long enough to not matter in
// practice; the subscription can still be cancelled anytime before then.
const TOTAL_CYCLES: Record<"monthly" | "annual", number> = {
  monthly: 120, // 10 years
  annual: 20, // 20 years
};

function getCredentials() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required.");
  }
  return { keyId, keySecret };
}

async function razorpayFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = getCredentials();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.description || `Razorpay API error (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export interface RazorpayCustomer {
  id: string;
}

export async function createCustomer(name: string, email: string): Promise<RazorpayCustomer> {
  return razorpayFetch<RazorpayCustomer>("/customers", {
    method: "POST",
    // fail_existing: "0" makes this idempotent -- Razorpay returns the
    // existing customer instead of erroring if name/email already exists.
    body: JSON.stringify({ name, email, fail_existing: "0" }),
  });
}

/**
 * Looks up a cached Razorpay Plan for this (interval, tier, amount)
 * combination -- a flat price, not per-student -- creating one on Razorpay
 * (and caching it) the first time it's needed. Only used by the optional
 * auto-pay path; manual billing uses Payment Links instead, which don't
 * need a pre-created Plan at all.
 */
export async function getOrCreatePlan(
  interval: "monthly" | "annual",
  tierMinStudents: number,
  totalRupees: number,
): Promise<{ razorpayPlanId: string; amountPaise: number }> {
  const [existing] = await db
    .select()
    .from(billingPlansTable)
    .where(
      and(
        eq(billingPlansTable.interval, interval),
        eq(billingPlansTable.tierMinStudents, tierMinStudents),
        eq(billingPlansTable.amountPaise, Math.round(totalRupees * 100)),
      ),
    )
    .limit(1);
  if (existing) {
    return { razorpayPlanId: existing.razorpayPlanId, amountPaise: existing.amountPaise };
  }

  const amountPaise = Math.round(totalRupees * 100);

  const plan = await razorpayFetch<{ id: string }>("/plans", {
    method: "POST",
    body: JSON.stringify({
      period: interval === "monthly" ? "monthly" : "yearly",
      interval: 1,
      item: {
        name: `PathshalaHQ tier (${tierMinStudents}+ students, ${interval})`,
        amount: amountPaise,
        currency: "INR",
      },
    }),
  });

  const [saved] = await db
    .insert(billingPlansTable)
    .values({ interval, tierMinStudents, razorpayPlanId: plan.id, amountPaise })
    .returning();

  return { razorpayPlanId: saved.razorpayPlanId, amountPaise: saved.amountPaise };
}

export interface RazorpaySubscription {
  id: string;
  status: string;
  short_url: string;
}

export async function createSubscription(params: {
  planId: string;
  customerId: string;
  interval: "monthly" | "annual";
  trialDays: number | null;
}): Promise<RazorpaySubscription> {
  const body: Record<string, any> = {
    plan_id: params.planId,
    customer_notify: 1,
    // Flat tier pricing -- quantity is always 1, unlike the old per-student
    // model. When a school crosses into a different tier, that's handled by
    // switching which Plan a future subscription/payment uses, not by
    // mutating this subscription's quantity (which Razorpay doesn't reliably
    // support post-authorization anyway -- confirmed via live testing).
    quantity: 1,
    total_count: TOTAL_CYCLES[params.interval],
    notes: { customer_id: params.customerId },
  };
  if (params.trialDays && params.trialDays > 0) {
    body.start_at = Math.floor(Date.now() / 1000) + params.trialDays * 86400;
  }
  return razorpayFetch<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface RazorpayPaymentLink {
  id: string;
  short_url: string;
}

export async function createPaymentLink(params: {
  amountRupees: number;
  description: string;
  customerName: string;
  customerEmail: string;
  expireBy?: Date;
}): Promise<RazorpayPaymentLink> {
  const body: Record<string, any> = {
    amount: Math.round(params.amountRupees * 100),
    currency: "INR",
    description: params.description,
    customer: { name: params.customerName, email: params.customerEmail },
    // We send our own branded email with this link (see mailer.ts) instead
    // of Razorpay's own notification, for consistent branding.
    notify: { sms: false, email: false },
    reminder_enable: false,
  };
  if (params.expireBy) {
    body.expire_by = Math.floor(params.expireBy.getTime() / 1000);
  }
  return razorpayFetch<RazorpayPaymentLink>("/payment_links", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Verifies the X-Razorpay-Signature header on an incoming webhook against
 * the raw request body. Must be called with the exact raw bytes Razorpay
 * signed, not a re-serialized/parsed version.
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!signature) return false;
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET environment variable is required.");
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
