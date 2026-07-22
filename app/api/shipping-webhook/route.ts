import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function normalizeCarrierStatus(status: string): string {
  if (!status) return "In Transit";
  const s = status.toLowerCase();

  if (s.includes("pickup") || s.includes("processing")) return "Processing";
  if (s.includes("dispatched") || s.includes("shipped")) return "Shipped";
  if (s.includes("transit")) return "In Transit";
  if (s.includes("out for delivery")) return "Out for Delivery";
  if (s.includes("delivered")) return "Delivered";

  return status;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const orderId =
      body.order_id || body.msg?.order_id || body.custom_order_id;
    const rawStatus =
      body.current_status || body.msg?.tag || body.status || "";

    if (!orderId) {
      return NextResponse.json(
        { status: "error", message: "Missing order_id in webhook payload" },
        { status: 400 }
      );
    }

    const newOrderStatus = normalizeCarrierStatus(rawStatus);

    // 1. Update ONLY 'order_status' in Supabase (matching existing schema)
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({ order_status: newOrderStatus })
      .or(`id.eq.${orderId}`)
      .select()
      .single();

    if (error) {
      console.error("Supabase Shipping Webhook Error:", error);
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 500 }
      );
    }

    // 2. Trigger automated WhatsApp update to customer
    if (updatedOrder) {
      const phone = updatedOrder.phone_number || updatedOrder.phone;
      if (phone) {
        await notifyCustomerViaWhatsApp(
          phone,
          updatedOrder.id,
          newOrderStatus,
          body.courier_name,
          body.tracking_number
        );
      }
    }

    return NextResponse.json(
      {
        status: "success",
        message: `Order ${orderId} updated to '${newOrderStatus}'`,
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

async function notifyCustomerViaWhatsApp(
  phone: string,
  orderId: string,
  status: string,
  courier?: string,
  trackingNo?: string
) {
  try {
    let details = "";
    if (courier || trackingNo) {
      details = `\n🚚 *Courier:* ${courier || "Express"}\n📍 *Tracking No:* ${trackingNo || "N/A"}`;
    }

    const message = `📦 *Shipment Update (#${orderId}):*\nStatus: *${status}*${details}`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await fetch(`${baseUrl}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
  } catch (err) {
    console.error("Failed to send WhatsApp shipping notification:", err);
  }
}