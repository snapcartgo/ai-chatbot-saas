import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  const { lead_id, product_name, price, bot_id } =
    await req.json();

  const { data, error } = await supabase
    .from("orders")
    .insert({
      lead_id,
      product_name,
      price,
      bot_id,
      payment_status: "pending"
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error });
  }

  return NextResponse.json({ order: data });

}