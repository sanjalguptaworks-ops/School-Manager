import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { schoolsTable } from "./schools";
import { usersTable } from "./users";

// Who changed what, for the highest-value sensitive actions only (role
// changes, user deletion, suspension changes) -- not every mutation in the
// app, which would be disproportionate scope for what this is meant to do:
// give an admin/creator a trail for the handful of actions that actually
// warrant one. actorName is a denormalized snapshot so the log still reads
// correctly even if the actor's account is later deleted.
export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  details: text("details"),
  // The school this action is about (target school for creator actions,
  // the actor's own school for admin actions) -- null for platform-wide
  // creator actions with no single school in scope.
  schoolId: integer("school_id").references(() => schoolsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
