import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, bot_Id, conversationId } = await req.json();

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    const webhookResponse = await fetch(webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        bot_Id,
        conversationId,
      }),
    });

    const data = await webhookResponse.json();

    return new NextResponse(JSON.stringify({ reply: data.reply }), {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Content-Type": "application/json",
      },
    });

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