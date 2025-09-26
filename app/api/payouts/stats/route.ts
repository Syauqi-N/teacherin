import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payouts, bookings } from "@/db/schema";
import { teachers, profiles } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/payouts/stats - Get payout statistics (for teachers)
export async function GET(request: NextRequest) {
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

    // Get total paid out
    const totalPaidOutResult = await db.select({ 
      total: sql<string>`coalesce(sum(${payouts.amount}), '0')`
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.teacherId, teacher.id),
        eq(payouts.status, "PAID")
      )
    );

    const totalPaidOut = totalPaidOutResult[0]?.total || "0";

    // Get pending payout requests
    const pendingPayoutsResult = await db.select({ 
      total: sql<string>`coalesce(sum(${payouts.amount}), '0')`
    })
    .from(payouts)
    .where(
      and(
        eq(payouts.teacherId, teacher.id),
        eq(payouts.status, "REQUESTED")
      )
    );

    const pendingPayouts = pendingPayoutsResult[0]?.total || "0";

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