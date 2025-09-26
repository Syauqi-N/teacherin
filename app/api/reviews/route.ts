import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews } from "@/db/schema/sessions";
import { bookings } from "@/db/schema/bookings";
import { profiles, teachers } from "@/db/schema/users";
import { auth } from "@/lib/auth";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { UserWithRole } from "@/types/auth";

// GET /api/reviews - Get reviews with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const minRating = searchParams.get("minRating");
    const maxRating = searchParams.get("maxRating");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;
    
    let query = db.select({
      id: reviews.id,
      bookingId: reviews.bookingId,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      studentName: profiles.fullName,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .innerJoin(profiles, eq(bookings.studentProfileId, profiles.id));
    
    // Filter by teacher
    if (teacherId) {
      // @ts-ignore
      query = query.where(eq(bookings.teacherId, teacherId));
    }
    
    // Filter by rating range
    if (minRating) {
      // @ts-ignore
      query = query.where(gte(reviews.rating, parseInt(minRating)));
    }
    
    if (maxRating) {
      // @ts-ignore
      query = query.where(lte(reviews.rating, parseInt(maxRating)));
    }
    
    // Add pagination
    const reviewsList = await query
      .orderBy(reviews.createdAt)
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const countQuery = db.select({ count: sql<number>`count(*)` })
      .from(reviews)
      .innerJoin(bookings, eq(reviews.bookingId, bookings.id));
      
    if (teacherId) {
      // @ts-ignore
      countQuery.where(eq(bookings.teacherId, teacherId));
    }
    
    if (minRating) {
      // @ts-ignore
      countQuery.where(gte(reviews.rating, parseInt(minRating)));
    }
    
    if (maxRating) {
      // @ts-ignore
      countQuery.where(lte(reviews.rating, parseInt(maxRating)));
    }
    
    const countResult = await countQuery;
    const total = countResult[0].count;
    
    return NextResponse.json({
      reviews: reviewsList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/reviews - Create a new review
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId, rating, comment } = await request.json();
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }
    
    // Fetch booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        teacher: true,
      }
    });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    
    if (booking.studentProfileId !== (session.user as UserWithRole).profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "Booking must be completed to submit a review" }, { status: 400 });
    }
    
    // Check if review already exists
    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.bookingId, bookingId),
    });
    
    if (existingReview) {
      return NextResponse.json({ error: "Review already exists for this booking" }, { status: 400 });
    }
    
    // Create review
    const [review] = await db.insert(reviews).values({
      bookingId,
      rating,
      comment,
    }).returning();
    
    // Update teacher's average rating
    await updateTeacherAverageRating(booking.teacherId);
    
    return NextResponse.json({ review });
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/reviews/[id] - Update a review
export async function PUT(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewId = id;
    const { rating, comment } = await request.json();
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
    }
    
    // Fetch review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      with: {
        booking: {
          columns: {
            studentProfileId: true,
            teacherId: true,
          },
          with: {
            teacher: true,
          }
        }
      }
    });
    
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    
    if (review.booking.studentProfileId !== (session.user as UserWithRole).profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Update review
    const [updatedReview] = await db.update(reviews)
      .set({ rating, comment })
      .where(eq(reviews.id, reviewId))
      .returning();
    
    // Update teacher's average rating
    await updateTeacherAverageRating(review.booking.teacherId);
    
    return NextResponse.json({ review: updatedReview });
  } catch (error) {
    console.error("Error updating review:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/reviews/[id] - Delete a review
export async function DELETE(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const { id } = await context.params as { id: string };
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reviewId = id;
    
    // Fetch review
    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, reviewId),
      with: {
        booking: {
          columns: {
            studentProfileId: true,
            teacherId: true,
          },
          with: {
            teacher: true,
          }
        }
      }
    });
    
    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    
    // Check permissions
    let canDelete = false;
    
    if ((session.user as UserWithRole).role === "STUDENT" && review.booking.studentProfileId === (session.user as UserWithRole).profileId) {
      canDelete = true;
    } else if ((session.user as UserWithRole).role === "ADMIN") {
      canDelete = true;
    }
    
    if (!canDelete) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Delete review
    await db.delete(reviews).where(eq(reviews.id, reviewId));
    
    // Update teacher's average rating
    await updateTeacherAverageRating(review.booking.teacherId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting review:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper function to update teacher's average rating
async function updateTeacherAverageRating(teacherId: string) {
  try {
    // Calculate average rating
    const result = await db.select({
      avgRating: sql<number>`avg(rating)`,
      reviewCount: sql<number>`count(*)`,
    })
    .from(reviews)
    .innerJoin(bookings, eq(reviews.bookingId, bookings.id))
    .where(eq(bookings.teacherId, teacherId));
    
    const avgRating = result[0].avgRating || 0;
    const reviewCount = result[0].reviewCount || 0;
    
    // Update teacher record
    await db.update(teachers)
      .set({ 
        avgRating: avgRating.toString(),
      })
      .where(eq(teachers.id, teacherId));
  } catch (error) {
    console.error("Error updating teacher average rating:", error);
  }
}