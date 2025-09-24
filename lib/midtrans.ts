import Midtrans from "midtrans-client";
import { db } from "@/db";
import { payments, bookings } from "@/db/schema/bookings";
import { eq } from "drizzle-orm";

// Initialize Midtrans client
const snap = new Midtrans.Snap({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY || "",
  clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
});

// Create a payment transaction with Midtrans
export async function createMidtransTransaction(bookingId: string, userEmail: string, userName: string) {
  try {
    // Fetch booking details
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
      throw new Error("Booking not found");
    }
    
    // Convert price to IDR (assuming stored price is in thousands)
    const amount = Math.round(parseFloat(booking.totalPrice || "0") * 1000);
    
    // Create Midtrans transaction parameter
    const parameter = {
      transaction_details: {
        order_id: `booking-${bookingId}-${Date.now()}`,
        gross_amount: amount,
      },
      customer_details: {
        first_name: userName.split(" ")[0],
        last_name: userName.split(" ").slice(1).join(" ") || "-",
        email: userEmail,
      },
      item_details: [
        {
          id: `booking-${bookingId}`,
          price: amount,
          quantity: 1,
          name: `Lesson with ${booking.teacher?.profile?.fullName || "Teacher"}`,
          brand: "Teacherin",
          category: "Education",
        }
      ],
    };
    
    // Create transaction
    const transaction = await snap.createTransaction(parameter);
    
    return {
      redirect_url: transaction.redirect_url,
      token: transaction.token,
      order_id: parameter.transaction_details.order_id,
    };
  } catch (error) {
    console.error("Error creating Midtrans transaction:", error);
    throw error;
  }
}

// Handle Midtrans webhook notification
export async function handleMidtransWebhook(notification: Record<string, any>) {
  try {
    // Get transaction status
    const statusResponse = await snap.transaction.status(notification.transaction_id);
    
    // Find payment by order ID
    const payment = await db.query.payments.findFirst({
      where: (payments, { eq }) => eq(payments.gatewayRef, statusResponse.order_id),
    });
    
    if (!payment) {
      throw new Error("Payment not found");
    }
    
    // Update payment status based on Midtrans response
    let paymentStatus: "PENDING" | "SUCCESS" | "FAILED" = "PENDING";
    let bookingStatus: "PENDING" | "PAID" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "REFUNDED" = "PENDING";
    
    if (statusResponse.transaction_status === "settlement" && statusResponse.fraud_status === "accept") {
      paymentStatus = "SUCCESS";
      bookingStatus = "PAID";
    } else if (statusResponse.transaction_status === "deny" || 
               statusResponse.transaction_status === "cancel" || 
               statusResponse.transaction_status === "expire") {
      paymentStatus = "FAILED";
      bookingStatus = "CANCELLED";
    }
    
    // Update payment
    await db.update(payments)
      .set({ 
        status: paymentStatus,
        payload: statusResponse,
      })
      .where(eq(payments.id, payment.id));
    
    // Update booking
    await db.update(bookings)
      .set({ status: bookingStatus })
      .where(eq(bookings.id, payment.bookingId));
    
    return { success: true };
  } catch (error) {
    console.error("Error handling Midtrans webhook:", error);
    throw error;
  }
}