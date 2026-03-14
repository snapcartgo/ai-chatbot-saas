import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  try {

    const body = await req.json();

    const { bot_id, product_name, price } = body;

    const { data, error } = await supabase
      .from("orders")
      .insert({
        bot_id,
        product_name,
        price,
        payment_status: "pending"
      })
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error });
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (err) {

    console.error("Create order error:", err);

    return NextResponse.json({
      success: false
    });

  }

}