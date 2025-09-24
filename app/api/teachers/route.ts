import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { teachers, profiles, skills, teacherSkills } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, like, inArray, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/teachers - Get teachers with filtering and search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const search = searchParams.get("search") || "";
    const city = searchParams.get("city") || "";
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const minRating = searchParams.get("minRating");
    const skillIds = searchParams.get("skills")?.split(",") || [];
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const conditions = [];
    
    // Search by name
    if (search) {
      // @ts-ignore
      conditions.push(like(profiles.fullName, `%${search}%`));
    }
    
    // Filter by city
    if (city) {
      // @ts-ignore
      conditions.push(like(profiles.city, `%${city}%`));
    }
    
    // Filter by price range
    if (minPrice) {
      // @ts-ignore
      conditions.push(gte(teachers.pricePerHour, minPrice));
    }
    
    if (maxPrice) {
      // @ts-ignore
      conditions.push(lte(teachers.pricePerHour, maxPrice));
    }
    
    // Filter by rating
    if (minRating) {
      // @ts-ignore
      conditions.push(gte(teachers.avgRating, minRating));
    }
    
    let query = db.select({
      id: teachers.id,
      profileId: profiles.id,
      fullName: profiles.fullName,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      city: profiles.city,
      experienceYears: teachers.experienceYears,
      pricePerHour: teachers.pricePerHour,
      avgRating: teachers.avgRating,
      isVerified: teachers.isVerified,
      createdAt: teachers.createdAt,
    })
    .from(teachers)
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    // Filter by skills
    if (skillIds.length > 0) {
      // @ts-ignore
      query
        .innerJoin(teacherSkills, eq(teachers.id, teacherSkills.teacherId))
        .where(and(...conditions, inArray(teacherSkills.skillId, skillIds)));
    }
    
    // Add pagination
    const teachersList = await query
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(teachers)
      .innerJoin(profiles, eq(teachers.profileId, profiles.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    if (skillIds.length > 0) {
      // @ts-ignore
      countQuery
        .innerJoin(teacherSkills, eq(teachers.id, teacherSkills.teacherId))
        .where(and(...conditions, inArray(teacherSkills.skillId, skillIds)));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      teachers: teachersList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/teachers/[id] - Get a specific teacher by ID
export async function GET_BY_ID(request: NextRequest, context: { params: Promise<{}> }) {
  try {
    const { id } = await context.params as { id: string };
    const teacherId = id;
    
    // Fetch teacher with profile
    const teacherResult = await db.select({
      id: teachers.id,
      profileId: profiles.id,
      fullName: profiles.fullName,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      city: profiles.city,
      experienceYears: teachers.experienceYears,
      pricePerHour: teachers.pricePerHour,
      avgRating: teachers.avgRating,
      isVerified: teachers.isVerified,
      createdAt: teachers.createdAt,
    })
    .from(teachers)
    .innerJoin(profiles, eq(teachers.profileId, profiles.id))
    .where(eq(teachers.id, teacherId))
    .limit(1);
    
    if (teacherResult.length === 0) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    const teacher = teacherResult[0];
    
    // Fetch teacher's skills
    const teacherSkillsResult = await db.select({
      id: skills.id,
      name: skills.name,
    })
    .from(skills)
    .innerJoin(teacherSkills, eq(skills.id, teacherSkills.skillId))
    .where(eq(teacherSkills.teacherId, teacherId));
    
    return NextResponse.json({
      ...teacher,
      skills: teacherSkillsResult,
    });
  } catch (error) {
    console.error("Error fetching teacher:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/teachers - Create a new teacher profile (for teachers to update their profile)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      experienceYears,
      pricePerHour,
      bio,
      city,
      skillIds,
    } = await request.json();

    // Update teacher profile
    const [updatedTeacher] = await db.update(teachers)
      .set({
        experienceYears,
        pricePerHour,
      })
      .where(eq(teachers.profileId, (session.user as UserWithRole).profileId!))
      .returning();

    // Update user profile
    await db.update(profiles)
      .set({
        bio,
        city,
      })
      .where(eq(profiles.id, (session.user as UserWithRole).profileId!));

    // Update teacher skills
    if (skillIds && Array.isArray(skillIds)) {
      // First, delete existing skills
      await db.delete(teacherSkills)
        .where(eq(teacherSkills.teacherId, updatedTeacher.id));

      // Then insert new skills
      if (skillIds.length > 0) {
        await db.insert(teacherSkills).values(
          skillIds.map(skillId => ({
            teacherId: updatedTeacher.id,
            skillId,
          }))
        );
      }
    }

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error) {
    console.error("Error updating teacher profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}