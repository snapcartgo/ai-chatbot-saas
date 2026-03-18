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

    if (!order_id) {
      return NextResponse.json({ error: "Missing order_id" }, { status: 400 });
    }

    // ✅ UPDATE PAYMENT STATUS
    await supabase
      .from("orders")
      .update({ payment_status: "success" })
      .eq("id", order_id);

    // redirect to success page
    return NextResponse.redirect("https://ai-chatbot-saas-five.vercel.app/payment-success");

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error updating payment" }, { status: 500 });
  }
}