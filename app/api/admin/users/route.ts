import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, profiles, teachers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/admin/users - Get all users (for admins)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const conditions = [];
    if (role) {
      // @ts-ignore
      conditions.push(eq(profiles.role, role));
    }
    
    // Execute query with filters
    const usersList = await db.select({
      id: users.id,
      email: users.email,
      name: profiles.fullName,
      role: profiles.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(profiles, eq(users.id, profiles.userId))
    .where(conditions.length > 0 ? conditions[0] : undefined) // Simplified condition handling
    .orderBy(users.createdAt)
    .limit(limit)
    .offset(offset);
    
    // Get total count for pagination
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .innerJoin(profiles, eq(users.id, profiles.userId))
      .where(conditions.length > 0 ? conditions[0] : undefined);
    
    const total = countResult[0].count;
    
    return NextResponse.json({
      users: usersList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/users/[id]/status - Update user status (for admins)
export async function PUT(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = id;
    const { isActive } = await request.json();
    
    // Update user status
    const [updatedUser] = await db.update(users)
      .set({ isActive })
      .where(eq(users.id, userId))
      .returning();
    
    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] - Delete a user (for admins)
export async function DELETE(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = id;
    
    // Delete user (this will cascade to profiles, teachers, etc.)
    await db.delete(users).where(eq(users.id, userId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}