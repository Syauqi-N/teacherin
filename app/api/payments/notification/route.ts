import { NextRequest, NextResponse } from "next/server";
import { handleMidtransWebhook } from "@/lib/midtrans";

// POST /api/payments/notification - Handle Midtrans notification webhook
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Handle Midtrans webhook notification
    await handleMidtransWebhook(payload);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling Midtrans notification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}