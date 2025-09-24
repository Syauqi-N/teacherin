import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, bookings, profiles, teachers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/admin/transactions - Get all transactions (for admins)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const gateway = searchParams.get("gateway");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    let query = db.select({
      id: payments.id,
      bookingId: payments.bookingId,
      gateway: payments.gateway,
      gatewayRef: payments.gatewayRef,
      amount: payments.amount,
      status: payments.status,
      createdAt: payments.createdAt,
      studentName: profiles.fullName,
      teacherName: profiles.fullName,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(profiles, eq(bookings.studentProfileId, profiles.id))
    .innerJoin(teachers, eq(bookings.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id));
    
    // Filter by status if provided
    if (status) {
      // @ts-ignore
      query = query.where(eq(payments.status, status));
    }
    
    // Filter by gateway if provided
    if (gateway) {
      // @ts-ignore
      query = query.where(eq(payments.gateway, gateway));
    }
    
    // Filter by date range if provided
    if (startDate) {
      // @ts-ignore
      query = query.where(gte(payments.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      // @ts-ignore
      query = query.where(lte(payments.createdAt, new Date(endDate)));
    }
    
    // Add pagination
    const paymentsList = await query
      .orderBy(payments.createdAt)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(payments);
      
    if (status) {
      // @ts-ignore
      countQuery.where(eq(payments.status, status));
    }
    
    if (gateway) {
      // @ts-ignore
      countQuery.where(eq(payments.gateway, gateway));
    }
    
    if (startDate) {
      // @ts-ignore
      countQuery.where(gte(payments.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      // @ts-ignore
      countQuery.where(lte(payments.createdAt, new Date(endDate)));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      payments: paymentsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/transactions/[id]/status - Update transaction status (for admins)
export async function PUT(request: NextRequest, context: { params: Promise<{}> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paymentId = id;
    const { status } = await request.json();
    
    // Validate status
    if (!["SUCCESS", "FAILED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    
    // Fetch payment
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
    });
    
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    
    // Update payment status
    const [updatedPayment] = await db.update(payments)
      .set({ status })
      .where(eq(payments.id, paymentId))
      .returning();
    
    return NextResponse.json({ payment: updatedPayment });
  } catch (error) {
    console.error("Error updating transaction status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/admin/transactions/stats - Get transaction statistics (for admins)
export async function STATS(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get total transactions
    const totalTransactions = await db.select({ count: sql<number>`count(*)` })
      .from(payments);

    // Get successful transactions
    const successfulTransactions = await db.select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.status, "SUCCESS"));

    // Get failed transactions
    const failedTransactions = await db.select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.status, "FAILED"));

    // Get total revenue
    const totalRevenueResult = await db.select({ 
      total: sql<number>`sum(amount)` 
    })
    .from(payments)
    .where(eq(payments.status, "SUCCESS"));

    const totalRevenue = totalRevenueResult[0].total || "0";

    return NextResponse.json({
      totalTransactions: totalTransactions[0].count,
      successfulTransactions: successfulTransactions[0].count,
      failedTransactions: failedTransactions[0].count,
      totalRevenue,
    });
  } catch (error) {
    console.error("Error fetching transaction statistics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}