import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TrackOrderRequestBody {
  phone?: string;
  order_id?: string;
  secret_token?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: TrackOrderRequestBody = await req.json();
    const { phone, order_id, secret_token } = body;

    // 1. Optional Security Token Check
    const expectedToken = process.env.CHATBOT_SECRET_KEY;
    if (expectedToken && secret_token !== expectedToken) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized request" },
        { status: 401 }
      );
    }

    // 2. Validate Input Parameters
    if (!phone && !order_id) {
      return NextResponse.json(
        {
          status: "error",
          message: "Please provide either a phone number or an Order ID.",
        },
        { status: 400 }
      );
    }

    // 3. Clean Phone Number (extracts last 10 digits)
    let cleanedPhone = phone ? phone.replace(/\D/g, "") : "";
    if (cleanedPhone.length > 10) {
      cleanedPhone = cleanedPhone.slice(-10);
    }

    // 4. Query Supabase Database matching your exact schema
    let query = supabase.from("orders").select("*");

    if (order_id) {
      // Search by 'id' (Primary key in your schema)
      query = query.eq("id", order_id.trim());
    } else if (cleanedPhone) {
      // Search across 'phone_number' or 'phone'
      query = query.or(
        `phone_number.ilike.%${cleanedPhone}%,phone.eq.${cleanedPhone}`
      );
    }

    // Fetch the most recent matching order using 'created_at'
    const { data: orders, error } = await query
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Supabase Query Error:", error);
      return NextResponse.json(
        { status: "error", message: "Database query failed." },
        { status: 500 }
      );
    }

    // 5. Handle No Order Found
    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { status: "not_found", message: "No matching order found." },
        { status: 404 }
      );
    }

    const order = orders[0];

    // 6. Return Data mapped to your database columns
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
          tracking_url: null, // Add your courier tracking column if added later
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