import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, materials } from "@/db/schema/sessions";
import { profiles } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/orders - Get orders for the current user
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
      id: orders.id,
      materialId: orders.materialId,
      amount: orders.amount,
      status: orders.status,
      createdAt: orders.createdAt,
      materialTitle: materials.title,
      materialPrice: materials.price,
      teacherName: profiles.fullName,
    })
    .from(orders)
    .innerJoin(materials, eq(orders.materialId, materials.id))
    .innerJoin(profiles, eq(materials.teacherId, profiles.id));
    
    // Filter by user role
    if ((session.user as UserWithRole).role === "STUDENT") {
      // @ts-ignore
      query = query.where(eq(orders.buyerProfileId, (session.user as UserWithRole).profileId!));
    }
    
    // Filter by status if provided
    if (status) {
      // @ts-ignore
      query = query.where(eq(orders.status, status));
    }
    
    // Add pagination
    const ordersList = await query
      .orderBy(orders.createdAt)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(orders);
      
    if ((session.user as UserWithRole).role === "STUDENT") {
      // @ts-ignore
      countQuery.where(eq(orders.buyerProfileId, (session.user as UserWithRole).profileId!));
    }
    
    if (status) {
      // @ts-ignore
      countQuery.where(eq(orders.status, status));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      orders: ordersList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/orders - Create a new order (purchase material)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { materialId } = await request.json();
    
    // Fetch material
    const material = await db.query.materials.findFirst({
      where: eq(materials.id, materialId),
    });
    
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    
    if (!material.isPublished) {
      return NextResponse.json({ error: "Material is not published" }, { status: 400 });
    }
    
    // Check if order already exists
    const existingOrder = await db.query.orders.findFirst({
      where: and(
        eq(orders.buyerProfileId, (session.user as UserWithRole).profileId!),
        eq(orders.materialId, materialId),
        eq(orders.status, "PAID")
      ),
    });
    
    if (existingOrder) {
      return NextResponse.json({ error: "You have already purchased this material" }, { status: 400 });
    }
    
    // Create order
    const [order] = await db.insert(orders).values({
      buyerProfileId: (session.user as UserWithRole).profileId!,
      materialId,
      amount: material.price,
      status: "PENDING",
    }).returning();
    
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/orders/[id]/status - Update order status (for payment processing)
export async function PUT(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = id;
    const { status } = await request.json();
    
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
    
    // Check permissions
    let canUpdate = false;
    
    if ((session.user as UserWithRole).role === "STUDENT" && order.buyerProfileId === (session.user as UserWithRole).profileId) {
      // Students can cancel their orders
      if (status === "CANCELLED") {
        canUpdate = true;
      }
    } else if ((session.user as UserWithRole).role === "ADMIN") {
      // Admins can update any order
      canUpdate = true;
    }
    
    if (!canUpdate) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Update order status
    const [updatedOrder] = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, orderId))
      .returning();
    
    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/orders/[id]/download - Get download link for purchased material
export async function DOWNLOAD(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "STUDENT") {
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
    
    if (order.buyerProfileId !== (session.user as UserWithRole).profileId) {
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