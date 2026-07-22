import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_MAP: Record<string, string> = {
  ORDER_CONFIRMED: "Processing",
  MANUFACTURING_DONE: "Out of Factory",
  DISPATCHED: "Shipped",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, event_type, tracking_number, courier_name } = body;

    if (!order_id || !event_type) {
      return NextResponse.json(
        { status: "error", message: "Missing order_id or event_type" },
        { status: 400 }
      );
    }

    const newOrderStatus = STATUS_MAP[event_type] || event_type;

    const updatePayload: Record<string, any> = {
      order_status: newOrderStatus, // Target the order_status column in Supabase
    };

    if (tracking_number) updatePayload.tracking_number = tracking_number;
    if (courier_name) updatePayload.courier_name = courier_name;

    // Update Supabase 'orders' table
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", order_id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 500 }
      );
    }

    // Send WhatsApp notification to customer
    if (updatedOrder && (updatedOrder.phone_number || updatedOrder.phone)) {
      const phone = updatedOrder.phone_number || updatedOrder.phone;
      await sendWhatsAppStatusNotification(
        phone,
        updatedOrder.id,
        newOrderStatus
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: `Order status updated to ${newOrderStatus}`,
        updated_order: updatedOrder,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in status update endpoint:", err);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}

async function sendWhatsAppStatusNotification(
  phone: string,
  orderId: string,
  status: string
) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone,
        message: `📦 *Order Update (#${orderId}):* Your order status is now: *${status}*.`,
      }),
    });
  } catch (err) {
    console.error("Failed to send automated WhatsApp update:", err);
  }
}