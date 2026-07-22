import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. GET Handler (Required so Shiprocket verification & browser checks return 200 OK)
export async function GET() {
  return NextResponse.json(
    { status: "success", message: "Shipping webhook endpoint is active" },
    { status: 200 }
  );
}

// 2. POST Handler (Processes incoming tracking updates)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orderId =
      body.order_id || body.msg?.order_id || body.custom_order_id;
    const rawStatus =
      body.current_status || body.msg?.tag || body.status || "";
    const trackingNumber =
      body.tracking_number || body.awb || body.msg?.tracking_number;
    const courierName =
      body.courier_name || body.courier || body.msg?.slug;

    if (!orderId) {
      return NextResponse.json(
        { status: "error", message: "Missing order_id in payload" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      order_status: rawStatus || "In Transit",
    };
    if (trackingNumber) updateData.tracking_number = trackingNumber;
    if (courierName) updateData.courier_name = courierName;

    // Update DB
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(updateData)
      .or(`id.eq.${orderId},order_id.eq.${orderId}`)
      .select()
      .single();

    if (error) {
      console.error("Supabase Shipping Webhook Error:", error);
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: `Order ${orderId} updated successfully`,
        updated_order: updatedOrder,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error processing shipping webhook:", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}