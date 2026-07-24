import crypto from "crypto";

/**
 * Hand-rolled Web Push sender (RFC 8291 message encryption + RFC 8292 VAPID
 * auth), used because the `web-push` npm package couldn't be installed in
 * this environment (a pre-existing pnpm virtual-store-dir issue). The
 * message-encryption math is verified by a round-trip test (encrypt here,
 * decrypt with the inverse of what a browser does) -- see the PR/commit
 * this shipped in for that test script. Gracefully no-ops when
 * VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY aren't configured, same pattern as
 * lib/sms.ts and lib/whatsapp.ts.
 */

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return Buffer.from(withPad, "base64");
}

function getVapidPrivateKeyObject(publicKeyRaw: Buffer, privateKeyD: string): crypto.KeyObject {
  const x = publicKeyRaw.subarray(1, 33);
  const y = publicKeyRaw.subarray(33, 65);
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64url(x), y: b64url(y), d: privateKeyD },
    format: "jwk",
  });
}

function signVapidJwt(privateKeyObj: crypto.KeyObject, aud: string, subject: string): string {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject };
  const signingInput = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(Buffer.from(JSON.stringify(payload)))}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), { key: privateKeyObj, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${b64url(signature)}`;
}

// RFC 8291 aes128gcm encryption of the notification payload against the
// subscriber's ECDH public key (p256dh) and auth secret.
function encryptPayload(uaPublicRaw: Buffer, authSecret: Buffer, plaintext: string): Buffer {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPublicRaw);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublicRaw, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));

  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const record = Buffer.concat([Buffer.from(plaintext, "utf8"), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final()]);
  const tag = cipher.getAuthTag();

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(65, 20);

  return Buffer.concat([header, asPublic, ciphertext, tag]);
}

/**
 * Sends one Web Push message. Returns true on a successful push-service
 * response, false otherwise (including "not configured" and any delivery
 * failure) -- callers should treat a false return as "skip this
 * subscription", not throw.
 */
export async function sendWebPush(subscription: PushSubscriptionKeys, payload: { title: string; body: string; link?: string }): Promise<boolean> {
  const publicKeyB64 = process.env["VAPID_PUBLIC_KEY"];
  const privateKeyD = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] || "mailto:support@thinknbuild.in";
  if (!publicKeyB64 || !privateKeyD) return false;

  try {
    const uaPublicRaw = b64urlDecode(subscription.p256dhKey);
    const authSecret = b64urlDecode(subscription.authKey);
    const body = encryptPayload(uaPublicRaw, authSecret, JSON.stringify(payload));

    const publicKeyRaw = b64urlDecode(publicKeyB64);
    const privateKeyObj = getVapidPrivateKeyObject(publicKeyRaw, privateKeyD);
    const endpointUrl = new URL(subscription.endpoint);
    const aud = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const jwt = signVapidJwt(privateKeyObj, aud, subject);

    const res = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
      },
      body,
    });
    return res.ok;
  } catch {
    return false;
  }
}
