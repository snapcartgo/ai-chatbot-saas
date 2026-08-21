import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!rawBody) {
      return NextResponse.json({ message: "Empty body" }, { status: 200 });
    }

    const event = JSON.parse(rawBody);

    // Handle successful payment events
    if (event.event === "payment_link.paid" || event.event === "order.paid") {
      const orderId =
        event.payload?.payment_link?.entity?.reference_id ||
        event.payload?.payment?.entity?.notes?.order_id;

      const paymentId = event.payload?.payment?.entity?.id;

      if (orderId) {
        // Mark order as PAID in Supabase
        await supabase
          .from("orders")
          .update({
            payment_status: "PAID",
            payment_id: paymentId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}