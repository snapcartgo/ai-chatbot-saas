import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // 👇 PayU parameters
    const orderData = {
      amount: 999, // WhatsApp price
      productinfo: "whatsapp_plan",
      firstname: "User",
      email,
      udf1: email,
      udf2: "whatsapp",
    };

    // 👇 redirect to your payment gateway
    return NextResponse.json({
      success: true,
      data: orderData,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}