import jwt from "jsonwebtoken";

const SECRET = process.env["SESSION_SECRET"];
if (!SECRET) {
  throw new Error("SESSION_SECRET environment variable is required but was not provided.");
}

export interface SessionPayload {
  userId: number;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, SECRET) as SessionPayload;
}

export function signResetToken(userId: number): string {
  return jwt.sign({ userId, purpose: "reset" }, SECRET, { expiresIn: "1h" });
}

export function verifyResetToken(token: string): { userId: number } {
  const decoded = jwt.verify(token, SECRET) as { userId: number; purpose: string };
  if (decoded.purpose !== "reset") throw new Error("Invalid token purpose");
  return { userId: decoded.userId };
}

export function signEmailChangeToken(userId: number, newEmail: string): string {
  return jwt.sign({ userId, newEmail, purpose: "email-change" }, SECRET, { expiresIn: "1h" });
}

export function verifyEmailChangeToken(token: string): { userId: number; newEmail: string } {
  const decoded = jwt.verify(token, SECRET) as { userId: number; newEmail: string; purpose: string };
  if (decoded.purpose !== "email-change") throw new Error("Invalid token purpose");
  return { userId: decoded.userId, newEmail: decoded.newEmail };
}
