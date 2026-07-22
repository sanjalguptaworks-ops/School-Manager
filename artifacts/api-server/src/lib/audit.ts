import { db, auditLogTable } from "@workspace/db";

// Fire-and-forget, same reasoning as lib/notify.ts -- a failed/slow audit
// write should never break the action it's logging.
export async function logAuditEvent(entry: {
  actorUserId: number;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: string;
  schoolId?: number | null;
}): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorUserId: entry.actorUserId,
      actorName: entry.actorName,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      details: entry.details ?? null,
      schoolId: entry.schoolId ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log entry", err);
  }
}
