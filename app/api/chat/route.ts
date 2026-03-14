import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {

    const {
      message,
      conversation_id,
      bot_id,
      user_id,
      category
    } = await req.json();

    if (!message || !bot_id) {
      return new NextResponse(
        JSON.stringify({ reply: "Missing required fields." }),
        { status: 400 }
      );
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return new NextResponse(
        JSON.stringify({ reply: "Webhook URL not configured." }),
        { status: 500 }
      );
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversation_id,
        bot_id,
        user_id,
        category
      }),
    });

    const data = await webhookResponse.json();

    return new NextResponse(
      JSON.stringify({ reply: data.reply }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {

    console.error("Webhook error:", error);

    return new NextResponse(
      JSON.stringify({ reply: "Webhook failed." }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}