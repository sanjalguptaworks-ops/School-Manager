import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { schoolsTable } from "./schools";

// One row per browser/device a user has enabled push notifications on (a
// user can have several, e.g. phone + laptop). endpoint is unique per
// subscription -- re-subscribing the same browser upserts in place rather
// than piling up duplicates.
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schoolsTable.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.endpoint)],
);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
