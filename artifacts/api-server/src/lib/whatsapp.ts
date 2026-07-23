/**
 * Sends WhatsApp messages via Twilio's REST API (same account as SMS, just a
 * different sender number approved for WhatsApp). Every school has WhatsApp
 * opted out by default, same reasoning as SMS -- see school.whatsappEnabled
 * and isWhatsappEnabledForSchool.
 *
 * Built to gracefully no-op rather than throw when unconfigured: callers
 * (see lib/notify.ts) can fire this unconditionally alongside email/SMS, and
 * it silently skips until TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/
 * TWILIO_WHATSAPP_FROM_NUMBER are set on the server.
 */

/**
 * Bulk WhatsApp send, mirroring sendBulkSms's shape and budget-cap behavior.
 * Returns { sent: 0, skipped: recipients.length } whenever Twilio isn't
 * configured or there are no recipients -- never throws.
 */
export async function sendBulkWhatsapp(
  recipients: string[],
  body: string,
): Promise<{ sent: number; skipped: number }> {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const fromNumber = process.env["TWILIO_WHATSAPP_FROM_NUMBER"];
  const dailyBudget = parseInt(process.env["NOTIFY_DAILY_WHATSAPP_BUDGET"] || "20", 10);

  const unique = Array.from(new Set(recipients.filter(Boolean)));
  if (!accountSid || !authToken || !fromNumber || unique.length === 0) {
    return { sent: 0, skipped: unique.length };
  }

  const toSend = unique.slice(0, dailyBudget);
  const skipped = unique.length - toSend.length;

  const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const CONCURRENCY = 5;
  let sent = 0;
  for (let i = 0; i < toSend.length; i += CONCURRENCY) {
    const batch = toSend.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((to) =>
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: `whatsapp:${to}`,
            From: `whatsapp:${fromNumber}`,
            Body: body,
          }),
        }),
      ),
    );
    sent += results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
  }

  return { sent, skipped };
}
