import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, teachers } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, fullName, bio, city, experienceYears, pricePerHour } = await request.json();

    // Validate role
    if (!["STUDENT", "TEACHER"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Create user profile
    const [profile] = await db.insert(profiles).values({
      userId: session.user.id,
      role,
      fullName,
      bio,
      city,
    }).returning();

    // If user is a teacher, create teacher record
    if (role === "TEACHER") {
      await db.insert(teachers).values({
        profileId: profile.id,
        experienceYears,
        pricePerHour,
      });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user profile
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
      with: {
        teacher: true,
      }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Fetch profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}