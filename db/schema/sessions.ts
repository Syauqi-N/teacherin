import { pgTable, uuid, timestamp, text, integer, uniqueIndex, jsonb, boolean } from "drizzle-orm/pg-core";
import { bookings, teachers, profiles } from "./index";

// Session details for lessons
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }).unique(),
  meetingLink: text("meeting_link"),
  location: text("location"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
});

// Reviews and ratings
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }).unique(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Learning materials marketplace
export const materials = pgTable("materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  price: text("price"), // Using text for numeric
  fileKey: text("file_key"), // S3 path
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Orders for material purchases
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  buyerProfileId: uuid("buyer_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  materialId: uuid("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }),
  amount: text("amount"), // Using text for numeric
  status: text("status", { 
    enum: ["PENDING", "PAID", "CANCELLED", "REFUNDED"] 
  }).notNull().default("PENDING"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});