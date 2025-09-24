import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema/sessions";
import { bookings } from "@/db/schema/bookings";
import { teachers, profiles } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/sessions - Get sessions with filtering
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
      id: sessions.id,
      bookingId: sessions.bookingId,
      meetingLink: sessions.meetingLink,
      location: sessions.location,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      booking: {
        id: bookings.id,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        status: bookings.status,
        mode: bookings.mode,
        teacherName: profiles.fullName,
      }
    })
    .from(sessions)
    .innerJoin(bookings, eq(sessions.bookingId, bookings.id))
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
        // No sessions for non-teachers
        return NextResponse.json({
          sessions: [],
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
      // @ts-ignore
      query = query.where(eq(bookings.status, status));
    }
    
    // Add pagination
    const sessionsList = await query
      .orderBy(bookings.startTime)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(sessions)
      .innerJoin(bookings, eq(sessions.bookingId, bookings.id));
      
    if ((session.user as UserWithRole).role === "STUDENT") {
      // @ts-ignore
      countQuery.where(eq(bookings.studentProfileId, (session.user as UserWithRole).profileId!));
    } else if ((session.user as UserWithRole).role === "TEACHER") {
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (teacher) {
        // @ts-ignore
        countQuery.where(eq(bookings.teacherId, teacher.id));
      }
    }
    
    if (status) {
      // @ts-ignore
      countQuery.where(eq(bookings.status, status));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      sessions: sessionsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sessions - Create or update a session (for teachers)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId, meetingLink, location } = await request.json();
    
    // Verify that the teacher owns this booking
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    
    if (booking.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if session already exists
    const existingSession = await db.query.sessions.findFirst({
      where: eq(sessions.bookingId, bookingId),
    });
    
    if (existingSession) {
      // Update existing session
      const [updatedSession] = await db.update(sessions)
        .set({ meetingLink, location })
        .where(eq(sessions.id, existingSession.id))
        .returning();
      
      return NextResponse.json({ session: updatedSession });
    } else {
      // Create new session
      const [newSession] = await db.insert(sessions).values({
        bookingId,
        meetingLink,
        location,
      }).returning();
      
      return NextResponse.json({ session: newSession });
    }
  } catch (error) {
    console.error("Error creating/updating session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/sessions/[id]/start - Start a session
export async function START(request: NextRequest, context: { params: Promise<{}> }) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params as { id: string };
    const sessionId = id;
    
    // Verify that the teacher owns this session
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    const sessionRecord = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        booking: true,
      }
    });
    
    if (!sessionRecord) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    if (sessionRecord.booking.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Update booking status to "CONFIRMED"
    await db.update(bookings)
      .set({ status: "CONFIRMED" })
      .where(eq(bookings.id, sessionRecord.bookingId));
    
    // Start session
    const [updatedSession] = await db.update(sessions)
      .set({ startedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();
    
    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error("Error starting session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/sessions/[id]/end - End a session
export async function END(request: NextRequest, context: { params: Promise<{}> }) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params as { id: string };
    const sessionId = id;
    
    // Verify that the teacher owns this session
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    const sessionRecord = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        booking: true,
      }
    });
    
    if (!sessionRecord) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    if (sessionRecord.booking.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Update booking status to "COMPLETED"
    await db.update(bookings)
      .set({ status: "COMPLETED" })
      .where(eq(bookings.id, sessionRecord.bookingId));
    
    // End session
    const [updatedSession] = await db.update(sessions)
      .set({ endedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning();
    
    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error("Error ending session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}