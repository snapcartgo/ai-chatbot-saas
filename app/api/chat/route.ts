import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ratelimit } from "@/lib/ratelimit.js";

// ✅ Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ Extract UTR
const extractUTR = (text: string) => {
  const match = text.match(/\b\d{12}\b/);
  return match ? match[0] : null;
};

// ✅ Save message (FIXED TYPE)
async function saveMessage(data: {
  bot_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
}) {
  try {
    await supabase.from("messages").insert(data);
  } catch (err) {
    console.error("Message save error:", err);
  }
}

export async function POST(req: Request) {
  try {
    // 🔐 RATE LIMIT
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "anonymous";

    const { success } = await ratelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    const body = await req.json();

    const message = body.message;
    const bot_id = body.bot_id || body.chatbotId || body.activeBotId;
    const conversation_id =
      body.conversation_id || body.sessionId || crypto.randomUUID();
    const category = body.category || "general";

    const { user_id, product_name, price, email, order_id } = body;

    if (!message || !bot_id) {
      return NextResponse.json(
        { reply: "Error: Message or Bot ID is missing." },
        { status: 400 }
      );
    }

    const userMsg = String(message).toLowerCase();

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://ai-chatbot-saas-five.vercel.app";

    // 🔥 UTR Detection
    const detectedUTR = extractUTR(message);

    if (detectedUTR) {
      await supabase
        .from("orders")
        .update({
          utr_reference: detectedUTR,
          verification_status: "pending",
          payment_method: "upi",
        })
        .eq("id", order_id);

      const confirmReply = `Detected UTR: ${detectedUTR}. Verification started.`;

      await saveMessage({
        bot_id,
        conversation_id,
        role: "user",
        content: message,
      });

      await saveMessage({
        bot_id,
        conversation_id,
        role: "assistant",
        content: confirmReply,
      });

      return NextResponse.json({
        reply: confirmReply,
        intent: "payment_confirmation",
      });
    }

    // 🔗 N8N CALL
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { reply: "Webhook not configured." },
        { status: 500 }
      );
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bot-secret": process.env.N8N_BOT_SECRET || "",
      },
      body: JSON.stringify({
        message,
        bot_id,
        conversation_id,
        category,
      }),
    });

    const data = await webhookResponse.json();

    let botReply = data.reply || data.output || "No response";
    let paymentLink = data.payment_link || null;
    let intent = null;
    let redirectUrl = null;

    // 🧠 Intent logic
    if (/plan|billing/.test(userMsg)) {
      intent = "billing";
      redirectUrl = `${baseUrl}/dashboard/Billing`;
    } else if (/contact|support|help/.test(userMsg)) {
      intent = "support";
      redirectUrl = `${baseUrl}/contact`;
    }

    await saveMessage({
      bot_id,
      conversation_id,
      role: "user",
      content: message,
    });

    await saveMessage({
      bot_id,
      conversation_id,
      role: "assistant",
      content: botReply,
    });

    // 💳 Order creation
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

    return NextResponse.json({
      reply: botReply,
      payment_link: paymentLink,
      intent,
      redirect_url: redirectUrl,
    });
  } catch (error) {
    console.error("Error:", error);

    return NextResponse.json(
      { reply: "Server error." },
      { status: 500 }
    );
  }
}

// ✅ CORS FIX
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