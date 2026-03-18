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

    if (!order_id) return NextResponse.json({ error: "No Order ID" }, { status: 400 });

    // ✅ Target the specific e-commerce order
    const { data, error } = await supabase
      .from("orders")
      .update({ payment_status: "success" })
      .eq("id", order_id) // This MUST match the UUID in your screenshot
      .select();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
    }

    // If no rows were updated, the ID was wrong
    if (data.length === 0) {
      console.error("No order found with ID:", order_id);
    }

    return NextResponse.redirect("https://ai-chatbot-saas-five.vercel.app/payment-success");

  } catch (err) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}