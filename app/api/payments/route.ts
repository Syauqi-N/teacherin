import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payments, bookings } from "@/db/schema/bookings";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { createMidtransTransaction } from "@/lib/midtrans";
import { UserWithRole } from "@/types/auth";

// POST /api/payments - Create a new payment (initiate Midtrans payment)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || (session.user as UserWithRole).role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bookingId } = await request.json();
    
    // Fetch booking
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        teacher: {
          with: {
            profile: true,
          }
        }
      }
    });
    
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    
    if (booking.studentProfileId !== (session.user as UserWithRole).profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (booking.status !== "PENDING") {
      return NextResponse.json({ error: "Booking is not in pending status" }, { status: 400 });
    }
    
    // Create Midtrans transaction
    const transaction = await createMidtransTransaction(
      bookingId,
      session.user.email,
      session.user.name
    );
    
    // Create payment record
    const [payment] = await db.insert(payments).values({
      bookingId: booking.id,
      gateway: "MIDTRANS",
      gatewayRef: transaction.order_id,
      amount: booking.totalPrice,
      status: "PENDING",
      payload: {}, // Will be updated by webhook
    }).returning();
    
    return NextResponse.json({ 
      payment,
      paymentUrl: transaction.redirect_url,
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/payments/notification - Handle Midtrans notification webhook
export async function NOTIFICATION(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // In a real implementation, we would verify the webhook signature from Midtrans
    // For now, we'll process the notification
    
    // Handle Midtrans webhook notification
    // Handle Midtrans webhook notification
    // Note: This would need to be implemented in a separate route file in a real application
    // as Next.js route handlers can't have custom method names like WEBHOOK
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handling payment webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/payments/[id] - Get payment details
export async function GET(request: NextRequest, context: { params: Promise<{}> }) {
  const { id } = await context.params as { id: string };
  
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paymentId = id;
    
    // Fetch payment
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: {
        booking: {
          with: {
            teacher: {
              with: {
                profile: true,
              }
            }
          }
        }
      }
    });
    
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    
    // Check if user has access to this payment
    if ((session.user as UserWithRole).role === "STUDENT" && payment.booking.studentProfileId !== (session.user as UserWithRole).profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if ((session.user as UserWithRole).role === "TEACHER") {
      const teacher = await db.query.teachers.findFirst({
        where: eq(teachers.profileId, (session.user as UserWithRole).profileId!),
      });
      
      if (!teacher || payment.booking?.teacherId !== teacher.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    
    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Error fetching payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}