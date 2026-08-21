import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!rawBody || !signature) {
      return NextResponse.json({ error: "Missing payload or signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Extract Order ID / Reference ID
    const orderId =
      event.payload?.payment_link?.entity?.reference_id ||
      event.payload?.payment?.entity?.notes?.order_id ||
      event.payload?.order?.entity?.receipt;

    const paymentId =
      event.payload?.payment?.entity?.id ||
      event.payload?.payment_link?.entity?.payment_id;

    if (!orderId) {
      return NextResponse.json({ message: "No order ID found in event" }, { status: 200 });
    }

    // 1. Fetch Order and Merchant Secret from DB to verify signature
    const { data: order } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order?.user_id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("razorpay_key_secret")
      .eq("id", order.user_id)
      .single();

    // Verify cryptographic signature
    const secret = profile?.razorpay_key_secret || process.env.RAZORPAY_WEBHOOK_SECRET || "";
    if (secret) {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("Signature mismatch on Razorpay webhook");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    // 2. Update order to PAID upon successful event
    if (
      event.event === "payment_link.paid" ||
      event.event === "order.paid" ||
      event.event === "payment.captured"
    ) {
      await supabase
        .from("orders")
        .update({
          payment_status: "PAID",
          payment_id: paymentId || null,
          payment_method: "Razorpay",
        })
        .eq("id", orderId);
    }

    return NextResponse.json({ status: "success" });
  } catch (err: any) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}