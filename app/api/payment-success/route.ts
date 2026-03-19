import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const order_id = searchParams.get("order_id");

    // ❌ If no order_id
    if (!order_id) {
      return NextResponse.json(
        { error: "No Order ID provided" },
        { status: 400 }
      );
    }

    console.log("Updating order:", order_id);

    // ✅ UPDATE PAYMENT STATUS
    const { data, error } = await supabase
      .from("orders")
      .update({ payment_status: "success" })
      .eq("id", order_id)
      .select();

    // ❌ DB error
    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json(
        { error: "DB Update Failed" },
        { status: 500 }
      );
    }

    // ❌ No matching order
    if (!data || data.length === 0) {
      console.error("No order found with ID:", order_id);
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    console.log("Payment updated successfully:", data[0]);

    // ✅ REDIRECT TO SUCCESS PAGE
    return NextResponse.redirect(
      "https://ai-chatbot-saas-five.vercel.app/payment-success"
    );

  } catch (err) {
    console.error("Server Error:", err);
    return NextResponse.json(
      { error: "Server Error" },
      { status: 500 }
    );
  }
}