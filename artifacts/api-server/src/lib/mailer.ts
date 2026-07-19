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
 * Sends a confirmation link to a user's NEW email address when they request
 * an email change. The email only actually changes once this link is clicked.
 */
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
