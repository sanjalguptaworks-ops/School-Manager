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
