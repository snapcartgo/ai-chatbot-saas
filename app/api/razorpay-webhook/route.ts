import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Initialize using the Service Role Key to bypass RLS policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Double check this matches your .env file variable exactly!
);

const PLAN_LIMITS: Record<string, { chatbot_limit: number; message_limit: number }> = {
  starter: { chatbot_limit: 1, message_limit: 1000 },
  pro: { chatbot_limit: 2, message_limit: 3000 },
  growth: { chatbot_limit: 5, message_limit: 12000 },
  enterprise: { chatbot_limit: 10, message_limit: 20000 },
  whatsapp: { chatbot_limit: 1, message_limit: 0 },
};

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(bodyText)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("Webhook signature mismatch!");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(bodyText);

    if (payload.event === "payment.captured") {
      const payment = payload.payload.payment.entity;
      
      // Extract data safely from Payment Pages metadata hierarchy
      const planId = payment.notes?.planId || "starter";
      const email = payment.email;
      const amount = payment.amount / 100; // Convert paise to Rupees

      if (!email) {
        console.error("No email attached to payment payload");
        return NextResponse.json({ error: "No email provided" }, { status: 400 });
      }

      // Find user ID from the profiles or users schema
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (userError || !userData) {
        console.error("User match failed for email:", email, userError);
        return NextResponse.json({ error: "User not found in db" }, { status: 404 });
      }

      const userId = userData.id;
      const limits = PLAN_LIMITS[planId] || { chatbot_limit: 1, message_limit: 1000 };

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 30);

      // Match the exact column names from your database screenshot
      const { error: subError } = await supabaseAdmin
        .from("subscriptions")
        .upsert({
          user_id: userId,
          email: email,
          plan: planId,
          status: "active",
          chatbot_limit: limits.chatbot_limit,
          message_limit: limits.message_limit,
          message_used: 0,
          amount: amount,
          messages_reset_at: startDate.toISOString(),
          billing_cycle_start: startDate.toISOString(),
          billing_cycle_end: endDate.toISOString(),
          plan_expiry: endDate.toISOString().split("T")[0], // Formats to YYYY-MM-DD for date column
        }, { onConflict: "user_id" });

      if (subError) {
        console.error("Supabase Subscriptions insert crash:", subError);
        return NextResponse.json({ error: subError.message }, { status: 500 });
      }

      return NextResponse.json({ status: "success", message: "Database sync complete" });
    }

    return NextResponse.json({ status: "ignored" });
  } catch (err: any) {
    console.error("Crash event on webhook route:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}