/**
 * Sends email via Resend's HTTPS API (not SMTP).
 * Render's free tier blocks outbound SMTP ports, so we use a plain
 * HTTPS request instead — this always works regardless of hosting.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["MAIL_FROM"] || "no-reply@thinknbuild.in";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is required to send email.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `EduCore <${from}>`,
      to: [to],
      subject: "Reset your EduCore password",
      text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
      html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

/**
 * Sends one email to many recipients individually (Resend needs a separate
 * call per unique "to" for us to track failures per-address). Used for
 * notices/exam/fee notifications, where the audience can be a whole class
 * or the whole school.
 *
 * Resend's free plan caps out at 100 emails/day on one domain. If a batch
 * would exceed a safe daily budget, we send as many as we can and log the
 * rest as skipped rather than failing the whole request — the feature this
 * powers (creating a notice/exam/fee) should never be blocked by email limits.
 */
export async function sendBulkNotificationEmail(
  recipients: string[],
  subject: string,
  text: string,
  html: string,
): Promise<{ sent: number; skipped: number }> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["MAIL_FROM"] || "no-reply@thinknbuild.in";
  const dailyBudget = parseInt(process.env["NOTIFY_DAILY_EMAIL_BUDGET"] || "90", 10);

  const unique = Array.from(new Set(recipients.filter(Boolean)));
  if (!apiKey || unique.length === 0) {
    return { sent: 0, skipped: unique.length };
  }

  const toSend = unique.slice(0, dailyBudget);
  const skipped = unique.length - toSend.length;

  const CONCURRENCY = 5;
  let sent = 0;
  for (let i = 0; i < toSend.length; i += CONCURRENCY) {
    const batch = toSend.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((to) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: `EduCore <${from}>`, to: [to], subject, text, html }),
        }),
      ),
    );
    sent += results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
  }

  return { sent, skipped };
}
export async function sendEmailChangeConfirmation(to: string, confirmUrl: string): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["MAIL_FROM"] || "no-reply@thinknbuild.in";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is required to send email.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `EduCore <${from}>`,
      to: [to],
      subject: "Confirm your new EduCore email address",
      text: `Click the link below to confirm this is your new email address for EduCore. This link expires in 1 hour.\n\n${confirmUrl}\n\nIf you didn't request this change, you can ignore this email and your address will stay the same.`,
      html: `<p>Click the link below to confirm this is your new email address for EduCore. This link expires in 1 hour.</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>If you didn't request this change, you can ignore this email and your address will stay the same.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
