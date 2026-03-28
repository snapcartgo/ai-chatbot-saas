import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();

  // 🔥 Try multiple keys (important)
  const order_id =
    formData.get("txnid") ||
    formData.get("udf1") ||
    formData.get("productinfo");

  console.log("PayU response:", Object.fromEntries(formData));

  return NextResponse.redirect(
    `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${order_id}`
  );
}

// ALSO support GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const order_id =
    searchParams.get("txnid") ||
    searchParams.get("udf1");

  return NextResponse.redirect(
    `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${order_id}`
  );
}