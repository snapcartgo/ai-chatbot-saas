import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ratelimit } from "@/lib/ratelimit.js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const extractUTR = (text: string) => {
  const match = text.match(/\b\d{12}\b/);
  return match ? match[0] : null;
};

async function saveMessage(data: {
  user_id: string | null;
  bot_id: string | null;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  channel: "website" | "whatsapp";
}) {
  try {
    await supabase.from("messages").insert({
      ...data,
      phone_number: null,
      external_user_id: null,
    });
  } catch (err) {
    console.error("Message save error:", err);
  }
}

export async function POST(req: Request) {
  try {
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

    const rawMessage = String(body.message || "").trim();
    const bot_id = body.bot_id || body.chatbotId || body.activeBotId;
    const conversation_id =
      body.conversation_id || body.sessionId || crypto.randomUUID();
    const category = body.category || "general";
    const channel = body.channel === "whatsapp" ? "whatsapp" : "website";

    const { user_id, product_name, price, email, order_id } = body;
    const image_name = body.image_name || null;
    const image_type = body.image_type || null;
    const image_data_url = body.image_data_url || null;
    const audio_name = body.audio_name || null;
    const audio_type = body.audio_type || null;
    const audio_data_url = body.audio_data_url || null;

    const message =
      rawMessage ||
      (audio_name
        ? "Voice message attached"
        : image_name
        ? `Image attached: ${image_name}`
        : "");

    if (!bot_id || (!message && !image_data_url && !audio_data_url)) {
      return NextResponse.json(
        { reply: "Error: Message or Bot ID is missing." },
        { status: 400 }
      );
    }

    const userMsg = String(message).toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://woodpetra.in";

    const detectedUTR = extractUTR(message);

    if (detectedUTR) {
      await supabase
        .from("orders")
        .update({
          utr_reference: detectedUTR,
          verification_status: "pending",
          payment_method: "upi",
          channel,
        })
        .eq("id", order_id);

      const confirmReply = `Detected UTR: ${detectedUTR}. Verification started.`;

      await saveMessage({
        user_id: user_id || null,
        bot_id,
        conversation_id,
        role: "user",
        content: message,
        channel,
      });

      await saveMessage({
        user_id: user_id || null,
        bot_id,
        conversation_id,
        role: "assistant",
        content: confirmReply,
        channel,
      });

      return NextResponse.json({
        reply: confirmReply,
        intent: "payment_confirmation",
      });
    }

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
        channel,
        user_id,
        image_name,
        image_type,
        image_data_url,
        audio_name,
        audio_type,
        audio_data_url,
      }),
    });

    const data = await webhookResponse.json();

    if (!webhookResponse.ok) {
      return NextResponse.json(
        {
          reply:
            data?.reply ||
            data?.message ||
            "Webhook request failed.",
        },
        { status: 500 }
      );
    }

    const isProduct = data?.type === "product";
    const productMessage =
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : typeof data?.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : typeof data?.output === "string" && data.output.trim()
        ? data.output.trim()
        : isProduct
        ? "Here is a product you may like."
        : "No response";

    const paymentLink =
      typeof data?.payment_link === "string" ? data.payment_link : null;

    const productUrl =
  typeof data?.product_url === "string"
    ? data.product_url
    : null;

    let intent = null;
    let redirectUrl =
      typeof data?.redirect_url === "string" ? data.redirect_url : null;

    if (!redirectUrl) {
      if (/plan|billing/.test(userMsg)) {
        intent = "billing";
        redirectUrl = `${baseUrl}/dashboard/Billing`;
      } else if (/contact|support|help/.test(userMsg)) {
        intent = "support";
        redirectUrl = `${baseUrl}/contact`;
      } else if (paymentLink) {
        redirectUrl = paymentLink;
      }
    }

    await saveMessage({
      user_id: user_id || null,
      bot_id,
      conversation_id,
      role: "user",
      content: message,
      channel,
    });

    await saveMessage({
      user_id: user_id || null,
      bot_id,
      conversation_id,
      role: "assistant",
      content: productMessage,
      channel,
    });

    if (paymentLink && product_name && price) {
      await supabase.from("orders").insert({
        user_id,
        bot_id,
        product_name,
        price,
        payment_status: "pending",
        customer_email: email,
        channel,
      });
    }

    return NextResponse.json({
      type: isProduct ? "product" : "text",
      reply: isProduct ? null : productMessage,
      message: productMessage,
      name:
  typeof data?.name === "string"
    ? data.name
    : typeof data?.product_name === "string"
    ? data.product_name
    : null,
      description:
        typeof data?.description === "string" ? data.description : null,
      price:
        typeof data?.price === "number" || typeof data?.price === "string"
          ? data.price
          : null,
      image_url: typeof data?.image_url === "string" ? data.image_url : null,
      category: typeof data?.category === "string" ? data.category : null,
      product_url: productUrl,   // ADD THIS
      payment_link: paymentLink,
      intent,
      redirect_url: redirectUrl,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ reply: "Server error." }, { status: 500 });
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