import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();

  const order_id = formData.get("txnid");

  return NextResponse.redirect(
    `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${order_id}`
  );
}