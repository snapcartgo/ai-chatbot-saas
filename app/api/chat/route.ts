import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message, botId, conversationId } = await req.json();

    console.log("API RECEIVED:", { message, botId, conversationId });

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK;

    console.log("CALLING WEBHOOK:", webhookUrl);

    const webhookResponse = await fetch(webhookUrl!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        botId,
        conversationId,
      }),
    });

    console.log("WEBHOOK STATUS:", webhookResponse.status);

    const data = await webhookResponse.json();

    console.log("WEBHOOK RESPONSE:", data);

    return NextResponse.json({ reply: data.reply || "No reply from workflow" });

  } catch (error) {
    console.error("API ERROR:", error);

    return NextResponse.json({
      reply: "Webhook failed.",
    });
  }
}