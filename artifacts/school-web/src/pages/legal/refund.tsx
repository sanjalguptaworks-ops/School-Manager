import { LegalLayout } from "./layout";

export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Cancellation & Refund Policy" updated="July 21, 2026">
      <h2>1. Free trial</h2>
      <p>
        Every new school starts on a free trial (its length is shown in your dashboard). You are not charged during
        the trial, and you may stop using EduCore at any time before it ends at no cost.
      </p>

      <h2>2. Paid subscriptions</h2>
      <p>
        After the trial, continued use requires an active paid subscription, billed monthly or annually based on
        the school's enrolled student count. Payment is due for the billing period it covers before that period
        begins or, for a payment link sent by EduCore, within the link's validity window.
      </p>

      <h2>3. Cancellations</h2>
      <p>
        A school may cancel its subscription at any time by contacting thinknbuild.in@gmail.com or, where enabled, by
        turning off automatic payment from the Billing page. Cancelling stops future billing; the school keeps
        access through the end of the period already paid for.
      </p>

      <h2>4. Refunds</h2>
      <p>
        Because the trial period exists specifically so a school can evaluate EduCore before paying, subscription
        fees are generally non-refundable once a paid billing period has begun. If you believe you were charged in
        error — for example, a duplicate charge or a charge after cancellation — contact thinknbuild.in@gmail.com
        within 7 days of the charge and we will review it. Approved refunds are issued to the original payment
        method through Razorpay and may take 5–10 business days to appear, depending on your bank.
      </p>

      <h2>5. Suspended or lapsed accounts</h2>
      <p>
        If a billing period lapses without payment, access is paused until payment is made; no refund is owed for
        the paused period since no new period was billed. Reactivating a paused account resumes access immediately
        once payment is confirmed.
      </p>

      <h2>6. Contact</h2>
      <p>For billing questions, cancellations, or refund requests, email thinknbuild.in@gmail.com.</p>
    </LegalLayout>
  );
}
