import { pgTable, serial, integer, text, date, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schoolsTable } from "./schools";
import { studentsTable } from "./students";

export const libraryBooksTable = pgTable("library_books", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  author: text("author").notNull(),
  isbn: text("isbn"),
  totalCopies: integer("total_copies").notNull().default(1),
  availableCopies: integer("available_copies").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLibraryBookSchema = createInsertSchema(libraryBooksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertLibraryBook = z.infer<typeof insertLibraryBookSchema>;
export type LibraryBook = typeof libraryBooksTable.$inferSelect;

export const libraryLoansTable = pgTable("library_loans", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  bookId: integer("book_id")
    .notNull()
    .references(() => libraryBooksTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  issuedAt: date("issued_at", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  returnedAt: date("returned_at", { mode: "string" }),
  fineAmount: numeric("fine_amount", { precision: 10, scale: 2 }),
});

export const insertLibraryLoanSchema = createInsertSchema(libraryLoansTable).omit({
  id: true,
  returnedAt: true,
  fineAmount: true,
});
export type InsertLibraryLoan = z.infer<typeof insertLibraryLoanSchema>;
export type LibraryLoan = typeof libraryLoansTable.$inferSelect;
