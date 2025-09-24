import { pgTable, uuid, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Base users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  hash: text("hash"), // Password hash
  emailVerifiedAt: timestamp("email_verified_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// User profiles (student/teacher/admin)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  role: text("role", { enum: ["STUDENT", "TEACHER", "ADMIN"] }).notNull(),
  fullName: text("full_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  city: text("city"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    userIdx: uniqueIndex("profile_user_id_idx").on(table.userId),
  };
});

// Teachers (extends profiles)
export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }).unique(),
  experienceYears: text("experience_years"),
  pricePerHour: text("price_per_hour"), // Using text for numeric to avoid precision issues
  avgRating: text("avg_rating").default("0"),
  isVerified: boolean("is_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    profileIdx: uniqueIndex("teacher_profile_id_idx").on(table.profileId),
  };
});

// Skills
export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

// Teacher skills (M:N relationship)
export const teacherSkills = pgTable("teacher_skills", {
  teacherId: uuid("teacher_id").notNull().references(() => teachers.id, { onDelete: "cascade" }),
  skillId: uuid("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
}, (table) => {
  return {
    pk: uniqueIndex("teacher_skill_pk").on(table.teacherId, table.skillId),
  };
});