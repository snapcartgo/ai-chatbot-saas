import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js"; // Fixes the broken package name
import crypto from "crypto";

// Use Supabase Service Role Key to bypass Row Level Security (RLS) since this is a backend update
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// Map your planIds to their actual limits
const PLAN_LIMITS: Record<string, { chatbot_limit: number; message_limit: number }> = {
  starter: { chatbot_limit: 1, message_limit: 1000 },
  pro: { chatbot_limit: 2, message_limit: 3000 },
  growth: { chatbot_limit: 5, message_limit: 12000 },
  enterprise: { chatbot_limit: 10, message_limit: 20000 },
  whatsapp: { chatbot_limit: 1, message_limit: 0 }, // Adjust as needed for WhatsApp addon
};

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    
    // 1. Verify Webhook Signature for security
    const signature = req.headers.get("x-razorpay-signature") || "";
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(bodyText)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(bodyText);
    
    // 2. Handle captured payment event
    if (payload.event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      
      // Extract details from your payment notes or description
      // Note: Ensure your Razorpay links are passing notes, or extract planId from the payment description
      const planId = payment.notes?.planId || "starter"; 
      const email = payment.email; 
      const amount = payment.amount / 100; // Razorpay provides amounts in paise (e.g., 100 paise = ₹1)

      if (!email) {
        return NextResponse.json({ error: "No email linked to payment" }, { status: 400 });
      }

      // 3. Find user ID from email
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (userError || !userData) {
        console.error("User look up failed during webhook:", userError);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const userId = userData.id;
      const limits = PLAN_LIMITS[planId] || { chatbot_limit: 1, message_limit: 1000 };

      // 4. Calculate Billing & Reset Cycles (30 days from now)
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 30);

      // 5. Upsert or Update the Subscriptions Table
      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .upsert({
          user_id: userId,
          email: email,
          plan: planId,
          status: "active",
          chatbot_limit: limits.chatbot_limit,
          message_limit: limits.message_limit,
          message_used: 0, // Reset usage counter
          amount: amount,
          messages_reset_at: startDate.toISOString(),
          billing_cycle_start: startDate.toISOString(),
          billing_cycle_end: endDate.toISOString(),
          plan_expiry: endDate.toISOString().split("T")[0], // YYYY-MM-DD
        }, { onConflict: "user_id" }); // Assuming user_id is a unique key/constraint here

      if (subError) {
        console.error("Failed to update subscription record:", subError);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }

      return NextResponse.json({ status: "success", message: "Subscription activated" });
    }

    return NextResponse.json({ status: "ignored_event" });
  } catch (err: any) {
    console.error("Webhook route crash:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}