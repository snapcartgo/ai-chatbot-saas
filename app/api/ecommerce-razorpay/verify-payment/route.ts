import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses Service Role Key (bypasses RLS blocks)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { order_id, payment_id } = await req.json();

    if (!order_id) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // Update order status to PAID
    const { data, error } = await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "PAID",
        payment_id: payment_id || null,
        payment_method: "Razorpay",
      })
      .eq("id", order_id)
      .select()
      .maybeSingle();

    if (error) {
      console.error("Supabase Admin update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}