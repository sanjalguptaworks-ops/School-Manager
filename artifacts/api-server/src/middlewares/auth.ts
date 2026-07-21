import type { Request, Response, NextFunction } from "express";
import { db, usersTable, schoolsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifySession } from "../lib/jwt";
import { isSchoolSuspended } from "../lib/school-settings";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.["session"];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = verifySession(token);
    (req as any).authUserId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function requireRole(
  roles: string[],
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authUserId = (req as any).authUserId;
  if (!authUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
  if (!user[0]) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  if (!roles.includes(user[0].role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).dbUser = user[0];
  next();
}

export async function requireSchool(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authUserId = (req as any).authUserId;
  if (!authUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [me] = await db
    .select({
      schoolId: usersTable.schoolId,
      suspendedFrom: schoolsTable.suspendedFrom,
      suspendedUntil: schoolsTable.suspendedUntil,
    })
    .from(usersTable)
    .leftJoin(schoolsTable, eq(usersTable.schoolId, schoolsTable.id))
    .where(eq(usersTable.id, authUserId))
    .limit(1);
  if (!me?.schoolId) {
    res.status(403).json({ error: "Your account isn't linked to a school" });
    return;
  }
  if (isSchoolSuspended({ suspendedFrom: me.suspendedFrom, suspendedUntil: me.suspendedUntil })) {
    res.status(403).json({ error: "Your school's access has been suspended. Contact support." });
    return;
  }
  (req as any).schoolId = me.schoolId;
  next();
}

export async function loadUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authUserId = (req as any).authUserId;
  if (!authUserId) {
    next();
    return;
  }
  const user = await db.select().from(usersTable).where(eq(usersTable.id, authUserId)).limit(1);
  if (user[0]) (req as any).dbUser = user[0];
  next();
}
