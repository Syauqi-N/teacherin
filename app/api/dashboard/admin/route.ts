import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, profiles, teachers, bookings, payments, materials } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, sql } from "drizzle-orm";

// GET /api/dashboard/admin - Get admin dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get recent users
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      name: profiles.fullName,
      role: profiles.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.userId))
    .orderBy(desc(users.createdAt))
    .limit(10);

    // Get recent bookings
    const recentBookings = await db.select({
      id: bookings.id,
      studentName: profiles.fullName,
      teacherName: sql<string>`teacher_profiles.full_name`,
      startTime: bookings.startTime,
      status: bookings.status,
      totalPrice: bookings.totalPrice,
    })
    .from(bookings)
    .innerJoin(profiles, eq(bookings.studentProfileId, profiles.id))
    .innerJoin(teachers, eq(bookings.teacherId, teachers.id))
    .innerJoin(profiles.as('teacherProfiles'), eq(teachers.profileId, sql`teacher_profiles.id`))
    .orderBy(desc(bookings.createdAt))
    .limit(10);

    // Get recent payments
    const recentPayments = await db.select({
      id: payments.id,
      bookingId: payments.bookingId,
      gateway: payments.gateway,
      amount: payments.amount,
      status: payments.status,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(10);

    // Get recent materials
    const recentMaterials = await db.select({
      id: materials.id,
      title: materials.title,
      teacherName: profiles.fullName,
      price: materials.price,
      isPublished: materials.isPublished,
      createdAt: materials.createdAt,
    })
    .from(materials)
    .innerJoin(teachers, eq(materials.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .orderBy(desc(materials.createdAt))
    .limit(10);

    // Get statistics
    const totalUsers = await db.select({ count: sql<number>`count(*)` })
      .from(users);

    const totalTeachers = await db.select({ count: sql<number>`count(*)` })
      .from(teachers);

    const totalBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings);

    const totalRevenueResult = await db.select({ 
      total: sql<string>`coalesce(sum(${payments.amount}), '0')` 
    })
    .from(payments)
    .where(eq(payments.status, "SUCCESS"));

    const totalRevenue = totalRevenueResult[0]?.total || "0";

    return NextResponse.json({
      recentUsers,
      recentBookings,
      recentPayments,
      recentMaterials,
      stats: {
        totalUsers: totalUsers[0].count,
        totalTeachers: totalTeachers[0].count,
        totalBookings: totalBookings[0].count,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}