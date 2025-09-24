import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { skills } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { like } from "drizzle-orm";

// GET /api/skills - Get all skills or search by name
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    
    let query = db.select().from(skills);
    
    if (search) {
      query = query.where(like(skills.name, `%${search}%`));
    }
    
    const skillsList = await query.orderBy(skills.name);
    
    return NextResponse.json({ skills: skillsList });
  } catch (error) {
    console.error("Error fetching skills:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/skills - Create a new skill (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    
    // Check if skill already exists
    const existingSkill = await db.select().from(skills).where(like(skills.name, name)).limit(1);
    
    if (existingSkill.length > 0) {
      return NextResponse.json({ error: "Skill already exists" }, { status: 400 });
    }
    
    const [newSkill] = await db.insert(skills).values({ name }).returning();
    
    return NextResponse.json({ skill: newSkill });
  } catch (error) {
    console.error("Error creating skill:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}