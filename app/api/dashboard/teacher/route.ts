import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, reviews, materials, sessions, profiles, teachers, availabilitySlots } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, desc, and, gte, lt, sql } from "drizzle-orm";

// GET /api/dashboard/teacher - Get teacher dashboard data
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as any).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get teacher record
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as any).profileId),
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Get upcoming bookings
    const upcomingBookings = await db.select({
      id: bookings.id,
      studentName: profiles.fullName,
      studentAvatar: profiles.avatarUrl,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      mode: bookings.mode,
    })
    .from(bookings)
    .innerJoin(profiles, eq(bookings.studentProfileId, profiles.id))
    .where(
      and(
        eq(bookings.teacherId, teacher.id),
        eq(bookings.status, "CONFIRMED"),
        gte(bookings.startTime, new Date())
      )
    )
    .orderBy(desc(bookings.startTime))
    .limit(5);

    // Get recent bookings
    const recentBookings = await db.select({
      id: bookings.id,
      studentName: profiles.fullName,
      studentAvatar: profiles.avatarUrl,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      mode: bookings.mode,
    })
    .from(bookings)
    .innerJoin(profiles, eq(bookings.studentProfileId, profiles.id))
    .where(eq(bookings.teacherId, teacher.id))
    .orderBy(desc(bookings.createdAt))
    .limit(5);

    // Get recent reviews
    const recentReviews = await db.select({
      id: reviews.id,
      studentName: profiles.fullName,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .innerJoin(profiles, eq(bookings.studentProfileId, profiles.id))
    .where(eq(bookings.teacherId, teacher.id))
    .orderBy(desc(reviews.createdAt))
    .limit(5);

    // Get recent materials
    const recentMaterials = await db.select({
      id: materials.id,
      title: materials.title,
      price: materials.price,
      isPublished: materials.isPublished,
      createdAt: materials.createdAt,
    })
    .from(materials)
    .where(eq(materials.teacherId, teacher.id))
    .orderBy(desc(materials.createdAt))
    .limit(5);

    // Get upcoming availability slots
    const upcomingAvailability = await db.select({
      id: availabilitySlots.id,
      startTime: availabilitySlots.startTime,
      endTime: availabilitySlots.endTime,
      isBooked: availabilitySlots.isBooked,
    })
    .from(availabilitySlots)
    .where(
      and(
        eq(availabilitySlots.teacherId, teacher.id),
        eq(availabilitySlots.isBooked, false),
        gte(availabilitySlots.startTime, new Date())
      )
    )
    .orderBy(desc(availabilitySlots.startTime))
    .limit(5);

    // Get statistics
    const totalBookings = await db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(eq(bookings.teacherId, teacher.id));

    const completedSessions = await db.select({ count: sql<number>`count(*)` })
      .from(sessions)
      .innerJoin(bookings, eq(sessions.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.teacherId, teacher.id),
          eq(bookings.status, "COMPLETED")
        )
      );

    const totalEarningsResult = await db.select({ 
      total: sql<string>`coalesce(sum(${bookings.totalPrice}), '0')` 
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.teacherId, teacher.id),
        eq(bookings.status, "COMPLETED")
      )
    );

    const totalEarnings = totalEarningsResult[0]?.total || "0";

    const avgRating = teacher.avgRating || "0";

    return NextResponse.json({
      upcomingBookings,
      recentBookings,
      recentReviews,
      recentMaterials,
      upcomingAvailability,
      stats: {
        totalBookings: totalBookings[0].count,
        completedSessions: completedSessions[0].count,
        totalEarnings,
        avgRating,
      },
    });
  } catch (error) {
    console.error("Error fetching teacher dashboard data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}