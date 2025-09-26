import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { materials, orders } from "@/db/schema/sessions";
import { teachers, profiles } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, like, sql, or } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/materials - Get materials with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const teacherId = searchParams.get("teacherId");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const isPublished = searchParams.get("isPublished");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    let query = db.select({
      id: materials.id,
      teacherId: materials.teacherId,
      title: materials.title,
      description: materials.description,
      price: materials.price,
      isPublished: materials.isPublished,
      createdAt: materials.createdAt,
      teacherName: profiles.fullName,
    })
    .from(materials)
    .innerJoin(teachers, eq(materials.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(eq(materials.isPublished, true)); // Only show published materials
    
    // Search by title or description
    if (search) {
      // @ts-ignore
      query = query.where(
        and(
          eq(materials.isPublished, true),
          or(
            like(materials.title, `%${search}%`),
            like(materials.description, `%${search}%`)
          )
        )
      );
    }
    
    // Filter by teacher
    if (teacherId) {
      // @ts-ignore
      query = query.where(eq(materials.teacherId, teacherId));
    }
    
    // Filter by price range
    if (minPrice) {
      // @ts-ignore
      query = query.where(gte(materials.price, minPrice));
    }
    
    if (maxPrice) {
      // @ts-ignore
      query = query.where(lte(materials.price, maxPrice));
    }
    
    // Filter by published status (for teachers viewing their own materials)
    if (isPublished !== null) {
      // @ts-ignore
      query = query.where(eq(materials.isPublished, isPublished === "true"));
    }
    
    // Add pagination
    const materialsList = await query
      .orderBy(materials.createdAt)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(materials)
      .innerJoin(teachers, eq(materials.teacherId, teachers.id))
      .where(eq(materials.isPublished, true));
      
    if (search) {
      // @ts-ignore
      countQuery.where(
        and(
          eq(materials.isPublished, true),
          or(
            like(materials.title, `%${search}%`),
            like(materials.description, `%${search}%`)
          )
        )
      );
    }
    
    if (teacherId) {
      // @ts-ignore
      countQuery.where(eq(materials.teacherId, teacherId));
    }
    
    if (minPrice) {
      // @ts-ignore
      countQuery.where(gte(materials.price, minPrice));
    }
    
    if (maxPrice) {
      // @ts-ignore
      countQuery.where(lte(materials.price, maxPrice));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      materials: materialsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching materials:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/materials - Create a new material
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, price, fileKey } = await request.json();
    
    // Verify that the teacher exists
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    // Create material
    const [material] = await db.insert(materials).values({
      teacherId: teacher.id,
      title,
      description,
      price,
      fileKey,
      isPublished: false, // Materials are unpublished by default
    }).returning();
    
    return NextResponse.json({ material });
  } catch (error) {
    console.error("Error creating material:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/materials/[id] - Update a material
export async function PUT(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const materialId = id;
    const { title, description, price, fileKey, isPublished } = await request.json();
    
    // Fetch material
    const material = await db.query.materials.findFirst({
      where: eq(materials.id, materialId),
    });
    
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    
    // Verify that the teacher owns this material
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher || material.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Update material
    const [updatedMaterial] = await db.update(materials)
      .set({ title, description, price, fileKey, isPublished })
      .where(eq(materials.id, materialId))
      .returning();
    
    return NextResponse.json({ material: updatedMaterial });
  } catch (error) {
    console.error("Error updating material:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/materials/[id] - Delete a material
export async function DELETE(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const materialId = id;
    
    // Fetch material
    const material = await db.query.materials.findFirst({
      where: eq(materials.id, materialId),
    });
    
    if (!material) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    
    // Verify that the teacher owns this material
    const teacher = await db.query.teachers.findFirst({
      where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
    });
    
    if (!teacher || material.teacherId !== teacher.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Delete material
    await db.delete(materials).where(eq(materials.id, materialId));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting material:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/materials/[id] - Get a specific material
export async function GET_BY_ID(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const materialId = id;
    
    // Fetch material with teacher info
    const materialResult = await db.select({
      id: materials.id,
      teacherId: materials.teacherId,
      title: materials.title,
      description: materials.description,
      price: materials.price,
      isPublished: materials.isPublished,
      createdAt: materials.createdAt,
      teacherName: profiles.fullName,
      teacherBio: profiles.bio,
      teacherAvatarUrl: profiles.avatarUrl,
    })
    .from(materials)
    .innerJoin(teachers, eq(materials.teacherId, teachers.id))
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(eq(materials.id, materialId))
    .limit(1);
    
    if (materialResult.length === 0) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    
    const material = materialResult[0];
    
    return NextResponse.json({ material });
  } catch (error) {
    console.error("Error fetching material:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}