import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, availabilitySlots } from "@/db/schema/bookings";
import { teachers, profiles } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/bookings - Get bookings for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    let query = db.select({
      id: bookings.id,
      teacherId: bookings.teacherId,
      studentProfileId: bookings.studentProfileId,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      status: bookings.status,
      totalPrice: bookings.totalPrice,
      mode: bookings.mode,
      notes: bookings.notes,
      createdAt: bookings.createdAt,
      teacherName: profiles.fullName,
    })
    .from(bookings)
    .innerJoin(teachers, eq(bookings.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id));
    
    // Filter by user role
    if ((session.user as UserWithRole).role === "STUDENT") {
      // @ts-ignore
      query = query.where(eq(bookings.studentProfileId, (session.user as UserWithRole).profileId!));
    } else if ((session.user as UserWithRole).role === "TEACHER") {
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (teacher) {
        // @ts-ignore
        query = query.where(eq(bookings.teacherId, teacher.id));
      } else {
        // No bookings for non-teachers
        return NextResponse.json({
          bookings: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }
    }
    
    // Filter by status if provided
    if (status) {
      query = query.where(eq(bookings.status, status));
    }
    
    // Add pagination
    const bookingsList = await query
      .orderBy(bookings.createdAt)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(bookings)
      .innerJoin(teachers, eq(bookings.teacherId, teachers.id));
      
    let countQueryWithFilters = countQuery;
    
    if ((session.user as UserWithRole).role === "STUDENT") {
      countQueryWithFilters = countQueryWithFilters.where(eq(bookings.studentProfileId, (session.user as UserWithRole).profileId!));
    } else if ((session.user as UserWithRole).role === "TEACHER") {
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (teacher) {
        countQueryWithFilters = countQueryWithFilters.where(eq(bookings.teacherId, teacher.id));
      }
    }
    
    if (status) {
      countQueryWithFilters = countQueryWithFilters.where(eq(bookings.status, status));
    }
    
    const countResult = await countQueryWithFilters;
    const total = countResult[0].count;
    
    return NextResponse.json({
      bookings: bookingsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { availabilitySlotId, mode, notes } = await request.json();
    
    // Get the availability slot
    const slot = await db.query.availabilitySlots.findFirst({
      where: eq(availabilitySlots.id, availabilitySlotId),
      with: {
        teacher: {
          with: {
            profile: true,
          }
        }
      }
    });
    
    if (!slot) {
      return NextResponse.json({ error: "Availability slot not found" }, { status: 404 });
    }
    
    if (slot.isBooked) {
      return NextResponse.json({ error: "Slot is already booked" }, { status: 400 });
    }
    
    // Check for overlapping bookings
    const overlappingBookings = await db.select().from(bookings).where(
      and(
        eq(bookings.teacherId, slot.teacherId),
        eq(bookings.status, "CONFIRMED"),
        or(
          and(
            gte(bookings.startTime, slot.startTime),
            sql`${bookings.startTime} < ${slot.endTime}`
          ),
          and(
            sql`${bookings.endTime} > ${slot.startTime}`,
            lte(bookings.endTime, slot.endTime)
          ),
          and(
            lte(bookings.startTime, slot.startTime),
            gte(bookings.endTime, slot.endTime)
          )
        )
      )
    );
    
    if (overlappingBookings.length > 0) {
      return NextResponse.json({ error: "Slot conflicts with existing booking" }, { status: 400 });
    }
    
    // Calculate total price
    const durationHours = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / (1000 * 60 * 60);
    const pricePerHour = slot.teacher?.profile?.pricePerHour || "0";
    const totalPrice = (parseFloat(pricePerHour) * durationHours).toString();
    
    // Create booking
    const [booking] = await db.insert(bookings).values({
      teacherId: slot.teacherId,
      studentProfileId: (session.user as UserWithRole).profileId!,
      startTime: slot.startTime,
      endTime: slot.endTime,
      totalPrice,
      mode,
      notes,
      status: "PENDING",
    }).returning();
    
    // Mark slot as booked
    await db.update(availabilitySlots)
      .set({ isBooked: true })
      .where(eq(availabilitySlots.id, availabilitySlotId));
    
    return NextResponse.json({ booking });
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/bookings/[id]/status - Update booking status
export async function PUT(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookingId = id;
    const { status } = await request.json();
    
    // Fetch booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        teacher: {
          with: {
            profile: true,
          }
        }
      }
    });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    
    // Check permissions
    let canUpdate = false;
    
    if ((session.user as UserWithRole).role === "STUDENT" && booking.studentProfileId === (session.user as UserWithRole).profileId) {
      // Students can cancel their bookings
      if (status === "CANCELLED") {
        canUpdate = true;
      }
    } else if ((session.user as UserWithRole).role === "TEACHER") {
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (teacher && booking.teacherId === teacher.id) {
        // Teachers can confirm bookings
        if (status === "CONFIRMED") {
          canUpdate = true;
        }
      }
    } else if ((session.user as UserWithRole).role === "ADMIN") {
      // Admins can update any booking
      canUpdate = true;
    }
    
    if (!canUpdate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Update booking status
    const [updatedBooking] = await db.update(bookings)
      .set({ status })
      .where(eq(bookings.id, bookingId))
      .returning();
    
    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper functions for date comparisons
function lt(date1: Date, date2: Date): boolean {
  return new Date(date1) < new Date(date2);
}

function gt(date1: Date, date2: Date): boolean {
  return new Date(date1) > new Date(date2);
}