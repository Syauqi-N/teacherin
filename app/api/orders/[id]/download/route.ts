import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/orders/[id]/download - Get download link for purchased material
export async function GET(request: NextRequest, context: { params: Promise<{}> }) {
  const { id } = await context.params as { id: string };
  
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = id;
    
    // Fetch order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        material: true,
      }
    });
    
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    
    if (order.buyerProfileId !== session.user.profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (order.status !== "PAID") {
      return NextResponse.json({ error: "Order is not paid" }, { status: 400 });
    }
    
    // In a real implementation, we would generate a signed URL for the file
    // For now, we'll return a mock download URL
    const downloadUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/materials/${order.materialId}/file`;
    
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("Error getting download link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}