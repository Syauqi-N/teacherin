import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { UserWithRole } from "@/types/auth";

// GET /api/admin/settings - Get admin settings (for admins)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // In a real implementation, we would fetch settings from the database
    // For now, we'll return mock settings
    const settings = {
      commissionRate: 0.1, // 10% commission
      minPayoutAmount: 50000, // IDR 50,000
      payoutProcessingTime: 3, // 3 business days
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching admin settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/settings - Update admin settings (for admins)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commissionRate, minPayoutAmount, payoutProcessingTime } = await request.json();
    
    // In a real implementation, we would save settings to the database
    // For now, we'll just return the updated settings
    const settings = {
      commissionRate,
      minPayoutAmount,
      payoutProcessingTime,
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating admin settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}