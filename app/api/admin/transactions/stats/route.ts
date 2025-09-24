import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/admin/transactions/stats - Get transaction statistics (for admins)
export async function GET(request: NextRequest) {
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