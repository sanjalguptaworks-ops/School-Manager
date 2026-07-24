import { pgTable, serial, integer, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";
import { studentsTable } from "./students";

// Route/stop assignment only -- no live GPS tracking, that needs actual
// hardware/driver-app infrastructure and is out of scope for this batch.
export const transportRoutesTable = pgTable("transport_routes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
});

export const insertTransportRouteSchema = createInsertSchema(transportRoutesTable).omit({
  id: true,
});
export type InsertTransportRoute = z.infer<typeof insertTransportRouteSchema>;
export type TransportRoute = typeof transportRoutesTable.$inferSelect;

export const transportStopsTable = pgTable("transport_stops", {
  id: serial("id").primaryKey(),
  routeId: integer("route_id")
    .notNull()
    .references(() => transportRoutesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Simple ordering within the route (1, 2, 3...) for display -- not a
  // physical distance/timing calculation.
  order: integer("order").notNull().default(0),
  pickupTime: text("pickup_time"),
  dropTime: text("drop_time"),
});

export const insertTransportStopSchema = createInsertSchema(transportStopsTable).omit({
  id: true,
});
export type InsertTransportStop = z.infer<typeof insertTransportStopSchema>;
export type TransportStop = typeof transportStopsTable.$inferSelect;

// One active assignment per student -- re-assigning a student to a
// different route/stop replaces the row rather than piling up history.
export const studentTransportTable = pgTable(
  "student_transport",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    routeId: integer("route_id")
      .notNull()
      .references(() => transportRoutesTable.id, { onDelete: "cascade" }),
    stopId: integer("stop_id")
      .notNull()
      .references(() => transportStopsTable.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.studentId)],
);

export const insertStudentTransportSchema = createInsertSchema(studentTransportTable).omit({
  id: true,
});
export type InsertStudentTransport = z.infer<typeof insertStudentTransportSchema>;
export type StudentTransport = typeof studentTransportTable.$inferSelect;
