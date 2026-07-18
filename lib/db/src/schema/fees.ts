import { pgTable, serial, integer, numeric, date, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { studentsTable } from "./students";

export const feeStructuresTable = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  term: text("term").notNull(),
});

export const insertFeeStructureSchema = createInsertSchema(feeStructuresTable).omit({
  id: true,
});
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;
export type FeeStructure = typeof feeStructuresTable.$inferSelect;

export const feePaymentsTable = pgTable(
  "fee_payments",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    feeStructureId: integer("fee_structure_id")
      .notNull()
      .references(() => feeStructuresTable.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "paid"] })
      .notNull()
      .default("pending"),
    paidOn: date("paid_on", { mode: "string" }),
  },
  (t) => [unique().on(t.studentId, t.feeStructureId)],
);

export const insertFeePaymentSchema = createInsertSchema(feePaymentsTable).omit({
  id: true,
  paidOn: true,
});
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;
export type FeePayment = typeof feePaymentsTable.$inferSelect;
