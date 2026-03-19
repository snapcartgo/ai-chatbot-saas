import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const order_id = searchParams.get("order_id");

  if (!order_id) {
    return NextResponse.json({ error: "No order_id" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", order_id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" });
  }

  // Recreate PayU hash again (IMPORTANT)
  const key = "YOUR_KEY"; // or fetch from profile
  const salt = "YOUR_SALT";

  const hashString = `${key}|${order.id}|${order.price}|${order.product_name}|test|${order.customer_email}|||||||||||${salt}`;

  const crypto = require("crypto");
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");

  return NextResponse.json({
    payu_data: {
      key,
      txnid: order.id,
      amount: order.price,
      productinfo: order.product_name,
      firstname: "test",
      email: order.customer_email,
      phone: "9999999999",
      surl: "https://ai-chatbot-saas-five.vercel.app/api/payment-success",
      furl: "https://ai-chatbot-saas-five.vercel.app/payment-failed",
      hash
    }
  });
}