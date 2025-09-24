import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, bookings, teachers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// PUT /api/sessions/[id]/start - Start a session
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = id;
    
    // Verify that the teacher owns this session
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, session.user.profileId),
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