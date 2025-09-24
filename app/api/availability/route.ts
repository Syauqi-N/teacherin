import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { availabilitySlots } from "@/db/schema/bookings";
import { teachers, profiles } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/availability - Get availability slots for a teacher
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    if (!teacherId) {
      return NextResponse.json({ error: "Teacher ID is required" }, { status: 400 });
    }
    
    let query = db.select().from(availabilitySlots).where(eq(availabilitySlots.teacherId, teacherId));
    
    // Filter by date range if provided
    if (startDate && endDate) {
      // @ts-ignore
      query = query.where(
        and(
          gte(availabilitySlots.startTime, new Date(startDate)),
          lte(availabilitySlots.endTime, new Date(endDate))
        )
      );
    }
    
    const slots = await query.orderBy(availabilitySlots.startTime);
    
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Error fetching availability slots:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/availability - Create new availability slots (for teachers)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slots } = await request.json();
    
    // Verify that the teacher owns these slots
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    // Validate that slots don't overlap with existing ones
    for (const slot of slots) {
      const overlappingSlots = await db.select().from(availabilitySlots).where(
        and(
          eq(availabilitySlots.teacherId, teacher.id),
          eq(availabilitySlots.isBooked, false),
          or(
            and(
              gte(availabilitySlots.startTime, new Date(slot.startTime)),
              lte(availabilitySlots.startTime, new Date(slot.endTime))
            ),
            and(
              gte(availabilitySlots.endTime, new Date(slot.startTime)),
              lte(availabilitySlots.endTime, new Date(slot.endTime))
            ),
            and(
              lte(availabilitySlots.startTime, new Date(slot.startTime)),
              gte(availabilitySlots.endTime, new Date(slot.endTime))
            )
          )
        )
      );
      
      if (overlappingSlots.length > 0) {
        return NextResponse.json({ error: `Slot overlaps with existing availability: ${slot.startTime} - ${slot.endTime}` }, { status: 400 });
      }
    }
    
    // Insert new slots
    const newSlots = await db.insert(availabilitySlots).values(
      slots.map((slot: any) => ({
        teacherId: teacher.id,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
        isBooked: false,
      }))
    ).returning();
    
    return NextResponse.json({ slots: newSlots });
  } catch (error) {
    console.error("Error creating availability slots:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/availability/[id] - Delete an availability slot (for teachers)
export async function DELETE(request: NextRequest, context: { params: Promise<{}> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const slotId = id;
    
    // Verify that the teacher owns this slot
    const slot = await db.query.availabilitySlots.findFirst({
      where: eq(availabilitySlots.id, slotId),
    });
    
    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher || slot.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Delete the slot
    await db.delete(availabilitySlots).where(eq(availabilitySlots.id, slotId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting availability slot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}