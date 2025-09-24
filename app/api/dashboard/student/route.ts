import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, reviews, orders, profiles, teachers, materials } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and, gte } from "drizzle-orm";

// GET /api/dashboard/student - Get student dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as any).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get upcoming bookings
    const upcomingBookings = await db.select({
      id: bookings.id,
      teacherName: profiles.fullName,
      teacherAvatar: profiles.avatarUrl,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      mode: bookings.mode,
    })
    .from(bookings)
    .innerJoin(teachers, eq(bookings.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(
      and(
        eq(bookings.studentProfileId, (session.user as any).profileId),
        eq(bookings.status, "CONFIRMED"),
        gte(bookings.startTime, new Date())
      )
    )
    .orderBy(desc(bookings.startTime))
    .limit(5);

    // Get recent bookings
    const recentBookings = await db.select({
      id: bookings.id,
      teacherName: profiles.fullName,
      teacherAvatar: profiles.avatarUrl,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      mode: bookings.mode,
    })
    .from(bookings)
    .innerJoin(teachers, eq(bookings.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(eq(bookings.studentProfileId, session.user.profileId as string))
    .orderBy(desc(bookings.createdAt))
    .limit(5);

    // Get recent orders
    const recentOrders = await db.select({
      id: orders.id,
      materialTitle: materials.title,
      teacherName: profiles.fullName,
      amount: orders.amount,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(materials, eq(orders.materialId, materials.id))
    .innerJoin(teachers, eq(materials.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(eq(orders.buyerProfileId, session.user.profileId as string))
    .orderBy(desc(orders.createdAt))
    .limit(5);

    // Get recent reviews
    const recentReviews = await db.select({
      id: reviews.id,
      teacherName: profiles.fullName,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .innerJoin(teachers, eq(bookings.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(eq(bookings.studentProfileId, session.user.profileId as string))
    .orderBy(desc(reviews.createdAt))
    .limit(5);

    return NextResponse.json({
      upcomingBookings,
      recentBookings,
      recentOrders,
      recentReviews,
    });
  } catch (error) {
    console.error("Error fetching student dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}