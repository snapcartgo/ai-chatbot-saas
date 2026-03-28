import { NextResponse } from "next/server";

// ✅ Handle POST (main PayU response)
export async function POST(req: Request) {
  const formData = await req.formData();
  const order_id = formData.get("txnid");

  return NextResponse.redirect(
    `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${order_id}`
  );
}

// ✅ Handle GET (fallback case)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const order_id = searchParams.get("txnid");

  return NextResponse.redirect(
    `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${order_id}`
  );
}