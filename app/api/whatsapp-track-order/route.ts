import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Support both payload keys from request body
    const phoneNumber = body.phone || body.phone_number;
    const { order_id } = body;

    if (!order_id && !phoneNumber) {
      return NextResponse.json(
        {
          status: "error",
          message: "Please provide either order_id or phone number.",
        },
        { status: 400 }
      );
    }

    // 1. Query the 'orders' table in Supabase
    let query = supabase.from("orders").select("*");

    if (order_id) {
      query = query.eq("id", order_id);
    } else if (phoneNumber) {
      // Query strictly against the 'phone' column in Supabase
      query = query.eq("phone", phoneNumber);
    }

    const { data: order, error } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !order) {
      return NextResponse.json(
        {
          status: "error",
          message: "No order found matching the given details.",
        },
        { status: 404 }
      );
    }

    // Clean tracking number if present
    const cleanTrackingNumber = order.tracking_number
      ? String(order.tracking_number).trim()
      : null;

    // 2. Generate tracking URL if tracking number exists
    const trackingUrl = cleanTrackingNumber
      ? `https://shiprocket.co/tracking/${cleanTrackingNumber}`
      : null;

    // 3. Return full order status details directly from the 'orders' table
    return NextResponse.json(
      {
        status: "success",
        data: {
          order_id: order.id,
          customer_name: order.name || "Customer",
          product: order.product_name || "N/A",
          amount: order.price ? order.price.toString() : "0",
          payment_status: order.payment_status || "PENDING",
          order_status: order.order_status || "Active",
          payment_method: order.payment_method || null,
          courier_name: order.courier_name || null,
          tracking_number: cleanTrackingNumber,
          tracking_url: trackingUrl,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in /api/whatsapp-track-order:", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" },
      { status: 500 }
    );
  }
}