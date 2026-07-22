// app/api/shipping-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. GET & OPTIONS handler for verification/preflight
export async function GET() {
  return NextResponse.json(
    { status: "success", message: "Webhook endpoint active" },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

// 2. Main POST handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // If Shiprocket sends an empty test ping, respond with 200 OK
    if (!body || Object.keys(body).length === 0) {
      return NextResponse.json(
        { status: "success", message: "Test request received" },
        { status: 200 }
      );
    }

    const orderId =
      body.order_id || body.msg?.order_id || body.custom_order_id;
    const rawStatus =
      body.current_status || body.msg?.tag || body.status || "";
    const trackingNumber =
      body.tracking_number || body.awb || body.msg?.tracking_number;
    const courierName =
      body.courier_name || body.courier || body.msg?.slug;

    // Standard processing
    if (orderId) {
      const updateData: Record<string, any> = {
        order_status: rawStatus || "In Transit",
      };
      if (trackingNumber) updateData.tracking_number = trackingNumber;
      if (courierName) updateData.courier_name = courierName;

      await supabase
        .from("orders")
        .update(updateData)
        .or(`id.eq.${orderId},order_id.eq.${orderId}`);
    }

    // ALWAYS return HTTP 200 to Shiprocket
    return NextResponse.json(
      { status: "success", message: "Webhook processed" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Webhook Error:", err);
    // Return 200 during testing so Shiprocket's ping succeeds
    return NextResponse.json(
      { status: "success", message: "Received" },
      { status: 200 }
    );
  }
}