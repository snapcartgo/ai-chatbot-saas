import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== DEDICATED CANCELLATION API =====");
  try {
    const body = await req.json();
    
    // ⚡ ADD THIS CLEANING LAYER TO FIX CRASHES:
    // If order_id is an empty string, convert it cleanly to null
    const order_id = body.order_id === "" ? null : body.order_id;
    const user_id = body.user_id;

    // 1. Check if the user forgot to provide an Order ID
    if (!order_id) {
      return NextResponse.json({
        success: false,
        requires_id: true,
        message: "Please provide your active Order ID so I can process the cancellation for you."
      });
    }

    // 2. Look up the order in Supabase to make sure it exists
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("verification_status")
      .eq("id", order_id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({
        success: false,
        requires_id: true,
        message: `I couldn't find an order matching ID #${order_id}. Please check the number and try again.`
      });
    }

    // 3. Prevent cancellation if it's already shipped or delivered
    if (order.verification_status === "shipped" || order.verification_status === "delivered") {
      return NextResponse.json({
        success: false,
        requires_id: false,
        message: `Sorry, Order #${order_id} has already been ${order.verification_status} and cannot be cancelled automatically.`
      });
    }

    // 4. Update the status in your Supabase 'orders' table to cancelled
    const { error: cancelError } = await supabase
      .from("orders")
      .update({ verification_status: "cancelled" })
      .eq("id", order_id);

    if (cancelError) {
      console.error("Supabase Cancellation Update Error:", cancelError.message);
      return NextResponse.json({ success: false, message: "Could not process cancellation at this moment." }, { status: 500 });
    }

    // Success response
    return NextResponse.json({
      success: true,
      message: `Your order #${order_id} has been successfully cancelled.`
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Server error encountered." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}