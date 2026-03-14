import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  const body = await req.json();

  const { order_id, transaction_id, status } = body;

  if (status === "success") {

    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_id: transaction_id
      })
      .eq("id", order_id);

  }

  return NextResponse.json({ received: true });

}