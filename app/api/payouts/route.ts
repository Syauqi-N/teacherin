import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payouts, bookings, teachers, profiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/payouts - Get payouts with filtering
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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    let query = db.select({
      id: payouts.id,
      teacherId: payouts.teacherId,
      amount: payouts.amount,
      status: payouts.status,
      requestedAt: payouts.requestedAt,
      processedAt: payouts.processedAt,
      notes: payouts.notes,
      teacherName: profiles.fullName,
    })
    .from(payouts)
    .innerJoin(teachers, eq(payouts.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id));
    
    // Filter by user role
    if ((session.user as UserWithRole).role === "TEACHER") {
      // Teachers can only see their own payouts
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (teacher) {
        // @ts-ignore
        query = query.where(eq(payouts.teacherId, teacher.id));
      } else {
        // No payouts for non-teachers
        return NextResponse.json({
          payouts: [],
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
      query = query.where(eq(payouts.status, status));
    }
    
    // Filter by date range if provided
    if (startDate) {
      // @ts-ignore
      query = query.where(gte(payouts.requestedAt, new Date(startDate)));
    }
    
    if (endDate) {
      // @ts-ignore
      query = query.where(lte(payouts.requestedAt, new Date(endDate)));
    }
    
    // Add pagination
    const payoutsList = await query
      .orderBy(payouts.requestedAt)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(payouts);
      
    if ((session.user as UserWithRole).role === "TEACHER") {
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (teacher) {
        // @ts-ignore
        countQuery.where(eq(payouts.teacherId, teacher.id));
      }
    }
    
    if (status) {
      // @ts-ignore
      countQuery.where(eq(payouts.status, status));
    }
    
    if (startDate) {
      // @ts-ignore
      countQuery.where(gte(payouts.requestedAt, new Date(startDate)));
    }
    
    if (endDate) {
      // @ts-ignore
      countQuery.where(lte(payouts.requestedAt, new Date(endDate)));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      payouts: payoutsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/payouts - Create a new payout request (for teachers)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount, notes } = await request.json();
    
    // Verify that the teacher exists
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    
    // Create payout request
    const [payout] = await db.insert(payouts).values({
      teacherId: teacher.id,
      amount: amount.toString(),
      status: "REQUESTED",
      notes,
    }).returning();
    
    return NextResponse.json({ payout });
  } catch (error) {
    console.error("Error creating payout request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/payouts/[id]/status - Update payout status (for admins)
export async function PUT(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payoutId = id;
    const { status, notes } = await request.json();
    
    // Validate status
    if (!["PROCESSING", "PAID", "FAILED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    
    // Fetch payout
    const payout = await db.query.payouts.findFirst({
      where: eq(payouts.id, payoutId),
    });
    
    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }
    
    // Update payout status
    const [updatedPayout] = await db.update(payouts)
      .set({ 
        status,
        processedAt: status === "PAID" || status === "FAILED" ? new Date() : undefined,
        notes: notes || payout.notes,
      })
      .where(eq(payouts.id, payoutId))
      .returning();
    
    return NextResponse.json({ payout: updatedPayout });
  } catch (error) {
    console.error("Error updating payout status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/payouts/stats - Get payout statistics (for teachers)
export async function STATS(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify that the teacher exists
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Get total earnings from completed bookings
    const totalEarningsResult = await db.select({ 
      total: sql<number>`sum(total_price)` 
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.teacherId, teacher.id),
        eq(bookings.status, "COMPLETED")
      )
    );

    const totalEarnings = totalEarningsResult[0].total || "0";

    // Get total paid out
    const totalPaidOutResult = await db.select({ 
      total: sql<number>`sum(amount)` 
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.teacherId, teacher.id),
        eq(payouts.status, "PAID")
      )
    );

    const totalPaidOut = totalPaidOutResult[0].total || "0";

    // Get pending payout requests
    const pendingPayoutsResult = await db.select({ 
      total: sql<number>`sum(amount)` 
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.teacherId, teacher.id),
        eq(payouts.status, "REQUESTED")
      )
    );

    const pendingPayouts = pendingPayoutsResult[0].total || "0";

    // Calculate available balance
    const availableBalance = (parseFloat(totalEarnings) - parseFloat(totalPaidOut) - parseFloat(pendingPayouts)).toString();

    return NextResponse.json({
      totalEarnings,
      totalPaidOut,
      pendingPayouts,
      availableBalance,
    });
  } catch (error) {
    console.error("Error fetching payout statistics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}