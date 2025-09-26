// Export all schema tables
export * from './auth';
export * from './users';
export * from './bookings';
export * from './sessions';
export * from './misc';

// Import to define relations
import { relations } from "drizzle-orm";
import { 
  users, 
  profiles, 
  teachers, 
  skills, 
  teacherSkills,
  userRelations,
  profilesRelations,
  teachersRelations,
  skillsRelations,
  teacherSkillsRelations
} from "./users";
import { 
  availabilitySlots, 
  bookings, 
  payments,
  availabilitySlotsRelations,
  bookingsRelations,
  paymentsRelations
} from "./bookings";
import { 
  sessions, 
  reviews, 
  materials, 
  orders,
  sessionsRelations,
  reviewsRelations,
  materialsRelations,
  ordersRelations
} from "./sessions";
import { 
  favorites, 
  payouts, 
  notifications,
  favoritesRelations,
  payoutsRelations,
  notificationsRelations
} from "./misc";
import { 
  user, 
  session, 
  account, 
  verification,
  userRelations as luciaUserRelations,
  sessionRelations,
  accountRelations
} from "./auth";

// Define cross-table relations to avoid circular dependencies
export const crossTableRelations = {
  // Users relations
  usersProfiles: relations(users, ({ one, many }) => ({
    profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
    session: many(session),
    account: many(account),
  })),
  
  profilesUsers: relations(profiles, ({ one, many }) => ({
    user: one(users, { fields: [profiles.userId], references: [users.id] }),
    teacher: one(teachers, { fields: [profiles.id], references: [teachers.profileId] }),
    favoriteTeachers: many(favorites),
    notifications: many(notifications),
    bookingsAsStudent: many(bookings),
    orders: many(orders),
  })),
  
  teachersProfiles: relations(teachers, ({ one, many }) => ({
    profile: one(profiles, { fields: [teachers.profileId], references: [profiles.id] }),
    teacherSkills: many(teacherSkills),
    availabilitySlots: many(availabilitySlots),
    bookings: many(bookings),
    materials: many(materials),
    payouts: many(payouts),
  })),
  
  // Bookings relations
  bookingsTeachers: relations(bookings, ({ one }) => ({
    teacher: one(teachers, { fields: [bookings.teacherId], references: [teachers.id] }),
    studentProfile: one(profiles, { fields: [bookings.studentProfileId], references: [profiles.id] }),
    availabilitySlot: one(availabilitySlots),
    session: one(sessions),
    review: one(reviews),
    payment: one(payments),
  })),
  
  // Availability slots relations
  availabilitySlotsTeachers: relations(availabilitySlots, ({ one }) => ({
    teacher: one(teachers, { fields: [availabilitySlots.teacherId], references: [teachers.id] }),
  })),
  
  // Sessions and reviews relations
  sessionsBookings: relations(sessions, ({ one }) => ({
    booking: one(bookings, { fields: [sessions.bookingId], references: [bookings.id] }),
  })),
  
  reviewsBookings: relations(reviews, ({ one }) => ({
    booking: one(bookings, { fields: [reviews.bookingId], references: [bookings.id] }),
    teacher: one(teachers, { fields: [bookings.teacherId], references: [teachers.id] }),
    studentProfile: one(profiles, { fields: [bookings.studentProfileId], references: [profiles.id] }),
  })),
  
  // Materials and orders relations
  materialsTeachers: relations(materials, ({ one, many }) => ({
    teacher: one(teachers, { fields: [materials.teacherId], references: [teachers.id] }),
    orders: many(orders),
  })),
  
  ordersBuyers: relations(orders, ({ one }) => ({
    buyerProfile: one(profiles, { fields: [orders.buyerProfileId], references: [profiles.id] }),
    material: one(materials, { fields: [orders.materialId], references: [materials.id] }),
  })),
  
  // Favorites relations
  favoritesProfiles: relations(favorites, ({ one }) => ({
    profile: one(profiles, { fields: [favorites.profileId], references: [profiles.id] }),
    teacher: one(teachers, { fields: [favorites.teacherId], references: [teachers.id] }),
  })),
  
  // Payouts relations
  payoutsTeachers: relations(payouts, ({ one }) => ({
    teacher: one(teachers, { fields: [payouts.teacherId], references: [teachers.id] }),
  })),
  
  // Notifications relations
  notificationsProfiles: relations(notifications, ({ one }) => ({
    profile: one(profiles, { fields: [notifications.profileId], references: [profiles.id] }),
  })),
  
  // Payments relations
  paymentsBookings: relations(payments, ({ one }) => ({
    booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
  })),
  
  // Lucia auth relations
  sessionUsers: relations(session, ({ one }) => ({
    user: one(user, { fields: [session.userId], references: [user.id] }),
  })),
  
  accountUsers: relations(account, ({ one }) => ({
    user: one(user, { fields: [account.userId], references: [user.id] }),
  })),
};

// Export all relations
export {
  userRelations,
  luciaUserRelations,
  sessionRelations,
  accountRelations,
  profilesRelations,
  teachersRelations,
  skillsRelations,
  teacherSkillsRelations,
  availabilitySlotsRelations,
  bookingsRelations,
  paymentsRelations,
  sessionsRelations,
  reviewsRelations,
  materialsRelations,
  ordersRelations,
  favoritesRelations,
  payoutsRelations,
  notificationsRelations,
  ...crossTableRelations,
};