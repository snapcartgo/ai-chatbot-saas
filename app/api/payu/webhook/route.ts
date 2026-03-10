import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {

    const data = await req.json();

    console.log("PayU webhook received:", data);

    return NextResponse.json({
      status: "success"
    });

  } catch (error) {

    console.error("Webhook error:", error);

    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    );
  }
}