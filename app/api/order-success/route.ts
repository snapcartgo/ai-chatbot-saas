import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const order_id = formData.get("txnid");

    console.log("PayU success for order:", order_id);

    return NextResponse.redirect(
      `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${order_id}`
    );

  } catch (err) {
    console.error("Error in order-success API:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}