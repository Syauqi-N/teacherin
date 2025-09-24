import { pgTable, uuid, timestamp, boolean, text, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { teachers } from "./users";
import { profiles } from "./users";

// Availability slots for teachers
export const availabilitySlots = pgTable("availability_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isBooked: boolean("is_booked").notNull().default(false),
}, (table) => {
  return {
    teacherTimeIdx: uniqueIndex("availability_teacher_time_idx").on(table.teacherId, table.startTime),
  };
});

// Bookings
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  studentProfileId: uuid("student_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status", { 
    enum: ["PENDING", "PAID", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED"] 
  }).notNull().default("PENDING"),
  totalPrice: text("total_price"), // Using text for numeric
  mode: text("mode", { enum: ["ONLINE", "OFFLINE"] }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    // Prevent double-booking per teacher/time range
    uniqueBookingIdx: uniqueIndex("unique_teacher_booking_time")
      .on(table.teacherId, table.startTime, table.endTime),
  };
});

// Payments
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }),
  gateway: text("gateway", { enum: ["MIDTRANS"] }).notNull(),
  gatewayRef: text("gateway_ref"),
  amount: text("amount"), // Using text for numeric
  status: text("status", { 
    enum: ["PENDING", "SUCCESS", "FAILED"] 
  }).notNull().default("PENDING"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});