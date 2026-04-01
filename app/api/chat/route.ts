import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Reusable function for saving messages
async function saveMessage({
  bot_id,
  conversation_id,
  role,
  content,
}: {
  bot_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
}) {
  try {
    await supabase.from("messages").insert({
      bot_id,
      conversation_id,
      role,
      content,
    });
  } catch (err) {
    console.error("Message save error:", err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🔑 Extract values safely
    const message = body.message;
    const bot_id = body.bot_id || body.chatbotId || body.activeBotId;

    // ✅ Safe conversation ID (VERY IMPORTANT)
    const conversation_id =
      body.conversation_id ||
      body.sessionId ||
      crypto.randomUUID();

    const category = body.category || "general";

    // Optional e-commerce / booking fields
    const { user_id, product_name, price, email } = body;

    // ❌ Validation
    if (!message || !bot_id) {
      return NextResponse.json(
        { reply: "Error: Message or Bot ID is missing in the request." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    // 🔁 Send to n8n
    const webhookResponse = await fetch(webhookUrl!, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-bot-secret": process.env.N8N_BOT_SECRET!,
  },
  body: JSON.stringify({
    message,
    bot_id,
    conversation_id,
    category,
  }),
});


    const data = await webhookResponse.json();

    const botReply = data.reply || data.output || "No response";

    // ✅ SAVE USER MESSAGE
    await saveMessage({
      bot_id,
      conversation_id,
      role: "user",
      content: message,
    });

    // ✅ SAVE BOT RESPONSE
    await saveMessage({
      bot_id,
      conversation_id,
      role: "assistant",
      content: botReply,
    });

    // 💰 E-commerce / Booking Logic
    let paymentLink = data.payment_link || null;

    if (paymentLink && product_name && price) {
      await supabase.from("orders").insert({
        user_id,
        bot_id,
        product_name,
        price,
        payment_status: "pending",
        customer_email: email,
      });
    }

    return NextResponse.json(
      {
        reply: botReply,
        payment_link: paymentLink,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Webhook Error:", error);

    return NextResponse.json(
      { reply: "Connection error." },
      { status: 500 }
    );
  }
}

// ✅ CORS support
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