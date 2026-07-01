import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== SECURE CANCELLATION API =====");
  try {
    const body = await req.json();
    
    // ⚡ CLEANING LAYER: Clean up symbols, spaces, and formatting quirks automatically
    let rawId = String(body.order_id || "").trim();
    
    // Strip hashtag if present
    if (rawId.startsWith("#")) {
      rawId = rawId.substring(1);
    }
    
    // Strip trailing periods or markdown characters
    rawId = rawId.replace(/[.#`*]/g, "").trim();

    const order_id = rawId === "" ? null : rawId;
    const customer_name = body.customer_name?.trim() || null;
    const phone = body.phone?.trim() || null;

    if (!order_id) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Please provide your active Order ID so I can look up your record."
      });
    }

    // Execute lookup with sanitized variable data
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("customer_name, phone, verification_status")
      .eq("id", order_id)
      .maybeSingle();

    if (fetchError || !order) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: `I couldn't find an order matching ID #${order_id}. Please check the ID and try again.`
      });
    }

    // Step 3: Check if the order is already shipped/delivered
    if (order.verification_status === "SHIPPED" || order.verification_status === "DELIVERED") {
      return NextResponse.json({
        success: false,
        requires_selection: false,
        message: `Sorry, Order #${order_id} has already been ${order.verification_status.toLowerCase()} and cannot be cancelled.`
      });
    }

    // Step 4: Verify Customer Name (Case-Insensitive)
    const dbName = String(order.customer_name || "").toLowerCase().trim();
    const inputName = String(customer_name || "").toLowerCase().trim();

    if (!customer_name || !dbName.includes(inputName)) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "For security verification, please share the Name used to place this order."
      });
    }

    // Step 5: Verify Phone Number (Matches last 10 digits to handle country codes safely)
    const dbPhone = String(order.phone || "").replace(/\D/g, "");
    const inputPhone = String(phone || "").replace(/\D/g, "");

    const cleanDbPhone = dbPhone.substring(dbPhone.length - 10);
    const cleanInputPhone = inputPhone.substring(inputPhone.length - 10);

    if (!phone || cleanDbPhone !== cleanInputPhone) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        message: "Almost done! Please confirm the Phone Number associated with this order."
      });
    }

    // Step 6: Success path! All 3 verified. Update to UPPERCASE "CANCELLED"
    const { error: cancelError } = await supabase
      .from("orders")
      .update({ verification_status: "CANCELLED" })
      .eq("id", order_id);

    if (cancelError) {
      console.error("Supabase Cancellation Update Error:", cancelError.message);
      return NextResponse.json({ success: false, message: "Could not process cancellation at this moment." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Verification Successful! Your order #${order_id} has been successfully cancelled.`
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