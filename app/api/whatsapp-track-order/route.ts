import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Support both payload keys
const phone_number = body.phone_number || body.phone;
const { order_id } = body;

    if (!order_id && !phone_number) {
      return NextResponse.json(
        {
          status: "error",
          message: "Please provide either order_id or phone_number.",
        },
        { status: 400 }
      );
    }

    // 1. Query the 'orders' table in Supabase
    let query = supabase.from("orders").select("*");

    if (order_id) {
      query = query.eq("id", order_id);
    } else if (phone_number) {
      query = query.eq("phone_number", phone_number);
    }

    const { data: order, error } = await query.order("created_at", { ascending: false }).limit(1).single();

    if (error || !order) {
      return NextResponse.json(
        {
          status: "error",
          message: "No order found matching the given details.",
        },
        { status: 404 }
      );
    }

    // 2. Generate tracking URL if AWB / tracking number exists from Shiprocket
    const trackingUrl = order.tracking_number
      ? `https://shiprocket.co/tracking/${order.tracking_number}`
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
          tracking_number: order.tracking_number || null,
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