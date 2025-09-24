import { pgTable, uuid, timestamp, text, uniqueIndex, jsonb, boolean } from "drizzle-orm/pg-core";
import { profiles } from "./users";
import { teachers } from "./users";

// Favorites (students can favorite teachers)
export const favorites = pgTable("favorites", {
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
}, (table) => {
  return {
    pk: uniqueIndex("favorite_pk").on(table.profileId, table.teacherId),
  };
});

// Payouts (teacher withdrawals)
export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  amount: text("amount"), // Using text for numeric
  status: text("status", { 
    enum: ["REQUESTED", "PROCESSING", "PAID", "FAILED"] 
  }).notNull().default("REQUESTED"),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  notes: text("notes"),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});