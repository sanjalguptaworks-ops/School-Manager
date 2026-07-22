/**
 * Sends SMS via Twilio's REST API. Every school has SMS opted out by
 * default (unlike email, which defaults on) since it costs money per
 * message -- see school.smsEnabled and isSmsEnabledForSchool.
 *
 * We don't have real Twilio credentials to test against, so this is built
 * to gracefully no-op rather than throw when unconfigured: callers (see
 * lib/notify.ts) can fire this unconditionally alongside the email send,
 * and it silently skips until TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/
 * TWILIO_FROM_NUMBER are set on the server.
 */

/**
 * Bulk SMS send, mirroring sendBulkNotificationEmail's shape and budget-cap
 * behavior. Returns { sent: 0, skipped: recipients.length } whenever Twilio
 * isn't configured or there are no recipients -- never throws.
 */
export async function sendBulkSms(
  recipients: string[],
  body: string,
): Promise<{ sent: number; skipped: number }> {
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];
  const fromNumber = process.env["TWILIO_FROM_NUMBER"];
  const dailyBudget = parseInt(process.env["NOTIFY_DAILY_SMS_BUDGET"] || "20", 10);

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
          body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
        }),
      ),
    );
    sent += results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
  }

  return { sent, skipped };
}
