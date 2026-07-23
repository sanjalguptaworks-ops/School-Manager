import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { classesTable } from "./classes";
import { schoolsTable } from "./schools";

// classId null = whole-school album, visible to every parent/student in the
// school -- same convention noticesTable already uses for its own classId.
export const galleryAlbumsTable = pgTable("gallery_albums", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  albumDate: date("album_date", { mode: "string" }).notNull(),
  classId: integer("class_id").references(() => classesTable.id, { onDelete: "set null" }),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schoolsTable.id, { onDelete: "cascade" }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const galleryPhotosTable = pgTable("gallery_photos", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id")
    .notNull()
    .references(() => galleryAlbumsTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGalleryAlbumSchema = createInsertSchema(galleryAlbumsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGalleryAlbum = z.infer<typeof insertGalleryAlbumSchema>;
export type GalleryAlbum = typeof galleryAlbumsTable.$inferSelect;

export const insertGalleryPhotoSchema = createInsertSchema(galleryPhotosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertGalleryPhoto = z.infer<typeof insertGalleryPhotoSchema>;
export type GalleryPhoto = typeof galleryPhotosTable.$inferSelect;
