import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      bot_id,
      user_id,
      product_name,
      price,
      payment_link,
      customer_email
    } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
  .from("orders")
  .insert([
    {
      bot_id,
      user_id,
      product_name,
      price,
      customer_email,
      payment_status: "pending"
    }
  ])
  .select()   // ✅ VERY IMPORTANT
  .single();  // ✅ VERY IMPORTANT

    if (error) {
      console.error(error);
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({
  success: true,
  order_id: data.id   // ✅ THIS IS KEY
});

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}