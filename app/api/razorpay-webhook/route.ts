export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    
    // 1. Verify signature authenticity safely
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(bodyText)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("❌ Razorpay webhook signature verification failed.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const body = JSON.parse(bodyText);

    // Filter for payment captured status only
    if (body.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const payment = body.payload.payment.entity;
    const paymentEmail = (payment.email || "").toLowerCase().trim();

    if (!paymentEmail) {
      return NextResponse.json({ error: "No email payload provided" }, { status: 400 });
    }

    console.log(`Processing valid checkout loop for consumer: ${paymentEmail}`);

    const executionStart = new Date();
    const activeExpiryWindow = new Date();
    activeExpiryWindow.setDate(executionStart.getDate() + 30);

    // 2. Direct Update based on the active email column row directly inside subscriptions table 
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        plan: "starter",
        chatbot_limit: 1,
        message_limit: 1000,
        message_used: 0,
        amount: Number(payment.amount || 0) / 100, // Convert paisa to rupees formatting
        messages_reset_at: executionStart.toISOString(),
        billing_cycle_start: executionStart.toISOString(),
        billing_cycle_end: activeExpiryWindow.toISOString(),
        plan_expiry: activeExpiryWindow.toISOString().split("T")[0],
      })
      .eq("email", paymentEmail); // Locates your exact 'azaaditheband@gmail.com' row instantly!

    if (subError) {
      console.error("❌ Supabase Write Failure:", subError.message);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    console.log(`🚀 Success! Row updated perfectly for user account: ${paymentEmail}`);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("❌ System runtime crash inside webhook handler:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}