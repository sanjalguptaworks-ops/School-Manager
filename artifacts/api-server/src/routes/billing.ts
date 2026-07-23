import { Router } from "express";
import {
  db,
  schoolsTable,
  studentsTable,
  classesTable,
  usersTable,
  pricingTiersTable,
  billingPaymentsTable,
  feePaymentsTable,
} from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, requireSchool, requireRole } from "../middlewares/auth";
import {
  createCustomer,
  createSubscription,
  createPaymentLink,
  getOrCreatePlan,
  verifyWebhookSignature,
} from "../lib/razorpay";
import { getTierForStudentCount, computeAmount } from "../lib/pricing";
import { sendPaymentLinkEmail } from "../lib/mailer";
import { generateReceiptNumber } from "../lib/receipt";

const router = Router();

async function getStudentCount(schoolId: number): Promise<number> {
  const rows = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .innerJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(classesTable.schoolId, schoolId));
  return rows.length;
}

function addInterval(date: Date, interval: "monthly" | "annual"): Date {
  const result = new Date(date);
  if (interval === "monthly") result.setMonth(result.getMonth() + 1);
  else result.setFullYear(result.getFullYear() + 1);
  return result;
}

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0] as string;
}

// ── Pricing tiers (creator only) ──────────────────────────────────────────

router.get("/billing/tiers", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const tiers = await db.select().from(pricingTiersTable).orderBy(asc(pricingTiersTable.minStudents));
      res.json(tiers);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

router.post("/billing/tiers", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const { minStudents, maxStudents, monthlyPriceRupees } = req.body;
      if (typeof minStudents !== "number" || typeof monthlyPriceRupees !== "number") {
        res.status(400).json({ error: "minStudents and monthlyPriceRupees are required" });
        return;
      }
      const [tier] = await db
        .insert(pricingTiersTable)
        .values({
          minStudents,
          maxStudents: typeof maxStudents === "number" ? maxStudents : null,
          monthlyPriceRupees,
        })
        .returning();
      res.status(201).json(tier);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

router.patch("/billing/tiers/:id", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const { minStudents, maxStudents, monthlyPriceRupees } = req.body;
      const updates: Record<string, any> = {};
      if (typeof minStudents === "number") updates.minStudents = minStudents;
      if (maxStudents === null || typeof maxStudents === "number") updates.maxStudents = maxStudents;
      if (typeof monthlyPriceRupees === "number") updates.monthlyPriceRupees = monthlyPriceRupees;

      const [tier] = await db.update(pricingTiersTable).set(updates).where(eq(pricingTiersTable.id, id)).returning();
      if (!tier) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.json(tier);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

router.delete("/billing/tiers/:id", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const id = parseInt(req.params["id"] as string);
      const [deleted] = await db.delete(pricingTiersTable).where(eq(pricingTiersTable.id, id)).returning();
      if (!deleted) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// ── Creator billing overview + payment-link generation ────────────────────

// GET /billing/overview — creator only. Every school with live student
// count, matched tier, computed price, and current billing status.
router.get("/billing/overview", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const schools = await db.select().from(schoolsTable);
      const overview = await Promise.all(
        schools.map(async (school) => {
          const studentCount = await getStudentCount(school.id);
          const tier = await getTierForStudentCount(studentCount);
          const interval = school.billingInterval || "monthly";
          const price = tier
            ? computeAmount({
                tierMonthlyPriceRupees: tier.monthlyPriceRupees,
                interval,
                discountPercent: school.discountPercent,
              })
            : null;
          return {
            schoolId: school.id,
            name: school.name,
            studentCount,
            tier,
            interval,
            price,
            billingMode: school.billingMode,
            paidUntil: school.paidUntil,
            trialStartedAt: school.trialStartedAt,
            trialDays: school.trialDays,
            discountPercent: school.discountPercent,
          };
        }),
      );
      res.json(overview);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /billing/generate/:schoolId — creator only. Computes the current
// tier price for this school, creates a Razorpay Payment Link, records it,
// and emails the school's admin(s) the link.
router.post("/billing/generate/:schoolId", requireAuth, async (req, res): Promise<void> => {
  await requireRole(["creator"], req, res, async () => {
    try {
      const schoolId = parseInt(req.params["schoolId"] as string);
      const { interval } = req.body as { interval?: "monthly" | "annual" };
      if (interval !== "monthly" && interval !== "annual") {
        res.status(400).json({ error: "interval must be 'monthly' or 'annual'" });
        return;
      }

      const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, schoolId)).limit(1);
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const [admin] = await db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(and(eq(usersTable.schoolId, schoolId), eq(usersTable.role, "admin")))
        .limit(1);
      if (!admin) {
        res.status(400).json({ error: "This school has no admin to notify" });
        return;
      }

      const studentCount = await getStudentCount(schoolId);
      const tier = await getTierForStudentCount(studentCount);
      if (!tier) {
        res.status(400).json({ error: "No pricing tiers configured yet" });
        return;
      }
      const price = computeAmount({
        tierMonthlyPriceRupees: tier.monthlyPriceRupees,
        interval,
        discountPercent: school.discountPercent,
      });

      const periodStart = new Date();
      const periodEnd = addInterval(periodStart, interval);
      const expireBy = new Date();
      expireBy.setDate(expireBy.getDate() + 15);

      const link = await createPaymentLink({
        amountRupees: price.totalRupees,
        description: `${school.name} — ${interval} subscription`,
        customerName: admin.name,
        customerEmail: admin.email,
        expireBy,
      });

      const [payment] = await db
        .insert(billingPaymentsTable)
        .values({
          schoolId,
          interval,
          periodStart: toDateString(periodStart),
          periodEnd: toDateString(periodEnd),
          studentCountAtGeneration: studentCount,
          tierMonthlyPriceRupees: tier.monthlyPriceRupees,
          discountPercent: school.discountPercent,
          subtotalRupees: price.subtotalRupees,
          taxPercent: price.taxPercent,
          totalRupees: price.totalRupees,
          razorpayPaymentLinkId: link.id,
          razorpayPaymentLinkUrl: link.short_url,
          status: "created",
        })
        .returning();

      let emailSent = false;
      try {
        await sendPaymentLinkEmail({
          to: admin.email,
          schoolName: school.name,
          amountRupees: price.totalRupees,
          interval,
          paymentUrl: link.short_url,
        });
        emailSent = true;
      } catch (mailErr) {
        req.log.error(mailErr, "Failed to send payment link email");
      }

      res.status(201).json({ ...payment, emailSent });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// ── Admin-facing status + optional auto-pay ───────────────────────────────

// GET /billing/status — admin only, school-scoped.
router.get("/billing/status", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, schoolId)).limit(1);
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const studentCount = await getStudentCount(schoolId);
      const tier = await getTierForStudentCount(studentCount);
      const interval = school.billingInterval || "monthly";
      const price = tier
        ? computeAmount({ tierMonthlyPriceRupees: tier.monthlyPriceRupees, interval, discountPercent: school.discountPercent })
        : null;

      const [pendingPayment] = await db
        .select()
        .from(billingPaymentsTable)
        .where(and(eq(billingPaymentsTable.schoolId, schoolId), eq(billingPaymentsTable.status, "created")))
        .orderBy(asc(billingPaymentsTable.createdAt))
        .limit(1);

      res.json({
        billingMode: school.billingMode,
        paidUntil: school.paidUntil,
        suspendedFrom: school.suspendedFrom,
        suspendedUntil: school.suspendedUntil,
        suspensionReason: school.suspensionReason,
        subscriptionStatus: school.subscriptionStatus,
        studentCount,
        tier,
        interval,
        price,
        pendingPayment: pendingPayment || null,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// POST /billing/auto-pay/start — admin only, school-scoped. Optional: sets
// up a real recurring Razorpay Subscription at the school's current flat
// tier price, instead of paying via creator-generated links each period.
router.post("/billing/auto-pay/start", requireAuth, requireSchool, async (req, res): Promise<void> => {
  await requireRole(["admin"], req, res, async () => {
    try {
      const schoolId = (req as any).schoolId;
      const authUserId = (req as any).authUserId;

      const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, schoolId)).limit(1);
      if (!school) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (school.billingMode === "auto") {
        res.status(400).json({ error: "Auto-pay is already set up for this school" });
        return;
      }

      const [admin] = await db.select().from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
      if (!admin) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const interval = school.billingInterval || "monthly";
      const studentCount = await getStudentCount(schoolId);
      const tier = await getTierForStudentCount(studentCount);
      if (!tier) {
        res.status(400).json({ error: "No pricing tiers configured yet" });
        return;
      }
      const price = computeAmount({
        tierMonthlyPriceRupees: tier.monthlyPriceRupees,
        interval,
        discountPercent: school.discountPercent,
      });

      const customer = school.razorpayCustomerId
        ? { id: school.razorpayCustomerId }
        : await createCustomer(admin.name, admin.email);
      const plan = await getOrCreatePlan(interval, tier.minStudents, price.totalRupees);
      const subscription = await createSubscription({
        planId: plan.razorpayPlanId,
        customerId: customer.id,
        interval,
        trialDays: null, // auto-pay is opt-in after trial/manual billing has already started
      });

      await db
        .update(schoolsTable)
        .set({
          razorpayCustomerId: customer.id,
          razorpaySubscriptionId: subscription.id,
          billingInterval: interval,
          subscriptionStatus: "created",
        })
        .where(eq(schoolsTable.id, schoolId));

      res.json({ checkoutUrl: subscription.short_url });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// ── Webhook (public, HMAC-verified) ────────────────────────────────────────

router.post("/billing/webhook", async (req, res): Promise<void> => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;
    const rawBody = (req as any).rawBody;
    if (!rawBody || !verifyWebhookSignature(rawBody, signature)) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const event = req.body?.event as string | undefined;
    if (!event) {
      res.status(200).json({ ok: true });
      return;
    }

    // Manual path: a creator-generated Payment Link was paid.
    if (event === "payment_link.paid") {
      const linkId = req.body?.payload?.payment_link?.entity?.id as string | undefined;
      if (!linkId) {
        res.status(200).json({ ok: true });
        return;
      }
      const [payment] = await db
        .select()
        .from(billingPaymentsTable)
        .where(eq(billingPaymentsTable.razorpayPaymentLinkId, linkId))
        .limit(1);
      if (payment) {
        await db
          .update(billingPaymentsTable)
          .set({ status: "paid", paidAt: new Date() })
          .where(eq(billingPaymentsTable.id, payment.id));

        const [school] = await db.select().from(schoolsTable).where(eq(schoolsTable.id, payment.schoolId)).limit(1);
        if (school) {
          const updates: Record<string, any> = { paidUntil: payment.periodEnd, billingMode: "manual" };
          // Never lift a suspension the creator set by hand.
          if (school.suspensionReason !== "manual") {
            updates.suspendedFrom = null;
            updates.suspendedUntil = null;
            updates.suspensionReason = null;
          }
          await db.update(schoolsTable).set(updates).where(eq(schoolsTable.id, school.id));
        }

        res.status(200).json({ ok: true });
        return;
      }

      // Not a school-subscription payment link -- check whether it's a
      // student fee payment link instead (see routes/fees.ts).
      const [feePayment] = await db
        .select({ id: feePaymentsTable.id })
        .from(feePaymentsTable)
        .where(eq(feePaymentsTable.razorpayPaymentLinkId, linkId))
        .limit(1);
      if (feePayment) {
        await db
          .update(feePaymentsTable)
          .set({ status: "paid", paidOn: toDateString(new Date()), receiptNumber: generateReceiptNumber(feePayment.id) })
          .where(eq(feePaymentsTable.id, feePayment.id));
      }

      res.status(200).json({ ok: true });
      return;
    }

    // Auto-pay path: subscription lifecycle events (unchanged from v1,
    // still driven by the same suspendedFrom/suspensionReason mechanism).
    const subscriptionId = req.body?.payload?.subscription?.entity?.id as string | undefined;
    if (!subscriptionId) {
      res.status(200).json({ ok: true });
      return;
    }

    const [school] = await db
      .select()
      .from(schoolsTable)
      .where(eq(schoolsTable.razorpaySubscriptionId, subscriptionId))
      .limit(1);
    if (!school) {
      res.status(200).json({ ok: true });
      return;
    }

    const canTouchSuspension = school.suspensionReason !== "manual";

    if (event === "subscription.authenticated") {
      await db.update(schoolsTable).set({ subscriptionStatus: "trialing" }).where(eq(schoolsTable.id, school.id));
    } else if (event === "subscription.activated" || event === "subscription.charged") {
      const subscriptionInterval = school.billingInterval || "monthly";
      const periodEnd = toDateString(addInterval(new Date(), subscriptionInterval));
      const updates: Record<string, any> = {
        subscriptionStatus: "active",
        billingMode: "auto",
        paidUntil: periodEnd,
      };
      if (canTouchSuspension) {
        updates.suspendedFrom = null;
        updates.suspendedUntil = null;
        updates.suspensionReason = null;
      }
      await db.update(schoolsTable).set(updates).where(eq(schoolsTable.id, school.id));
    } else if (event === "subscription.halted" || event === "subscription.cancelled") {
      const updates: Record<string, any> = {
        subscriptionStatus: event === "subscription.halted" ? "halted" : "cancelled",
      };
      if (canTouchSuspension) {
        updates.suspendedFrom = new Date().toISOString().split("T")[0];
        updates.suspendedUntil = null;
        updates.suspensionReason = "billing";
      }
      await db.update(schoolsTable).set(updates).where(eq(schoolsTable.id, school.id));
    }
    // Other events (e.g. subscription.pending, while Razorpay is still
    // retrying a failed charge) are intentionally not acted on -- we only
    // suspend once retries are exhausted (subscription.halted).

    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
