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

// Fixed error logging pattern for Supabase
async function saveMessage(data: {
  user_id: string | null;
  bot_id: string | null;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  channel: "website" | "whatsapp";
}) {
  const { error } = await supabase.from("messages").insert({
    ...data,
    phone_number: null,
    external_user_id: null,
  });

  if (error) {
    console.error("Supabase Message Save Error Details:", error.message, error.details);
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

    // Safely parse JSON body to prevent crashes if body is missing
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ reply: "Invalid or empty JSON body." }, { status: 400 });
    }

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

    // Use raw text input if available; prioritize showing attachments if input string is clean text fallback
    const message =
      rawMessage ||
      (audio_data_url
        ? `[Audio Attached: ${audio_name || "voice_msg"}]`
        : image_data_url
        ? `[Image Attached: ${image_name || "upload"}]`
        : "");

    if (!bot_id || (!message && !image_data_url && !audio_data_url)) {
      return NextResponse.json(
        { reply: "Error: Message or Bot ID is missing." },
        { status: 400 }
      );
    }

    const userMsg = String(message).toLowerCase();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://woodpetra.in";

    // UTR Verification Engine
    const detectedUTR = extractUTR(message);

    if (detectedUTR) {
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          utr_reference: detectedUTR,
          verification_status: "pending",
          payment_method: "upi",
          channel,
        })
        .eq("id", order_id);

      if (orderError) {
        console.error("Supabase Order Update Error:", orderError.message);
      }

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

    const rawData = await webhookResponse.json();

    if (!webhookResponse.ok) {
      return NextResponse.json(
        {
          reply:
            rawData?.reply ||
            rawData?.message ||
            "Webhook request failed.",
        },
        { status: 500 }
      );
    }

    // 1. Safe extraction logic to flatten any nested arrays/objects coming out of n8n
    let data: any = {};
    if (Array.isArray(rawData)) {
      const firstLevel = rawData[0];
      if (Array.isArray(firstLevel)) {
        data = firstLevel[0]?.json || firstLevel[0] || {};
      } else if (firstLevel && typeof firstLevel === "object") {
        data = firstLevel.json || firstLevel || {};
      }
    } else if (rawData && typeof rawData === "object") {
      data = rawData.json || rawData;
    }

    // 2. Compute intent validations
    const isProductIntent = data?.type === "product" || !!data?.product_name || !!data?.name;
    const isCategoryIntent = data?.type === "category" || /category|show collection|browse/i.test(userMsg);

    const productMessage =
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : typeof data?.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : typeof data?.output === "string" && data.output.trim()
        ? data.output.trim()
        : isProductIntent || isCategoryIntent
        ? "Here is what we found in our collection:"
        : "No response";

    const paymentLink =
      typeof data?.payment_link === "string" ? data.payment_link : null;

    const productUrl =
      typeof data?.product_url === "string" 
        ? data.product_url 
        : typeof data?.productUrl === "string"
        ? data.productUrl
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
      const { error: insertOrderError } = await supabase.from("orders").insert({
        user_id,
        bot_id,
        product_name,
        price,
        payment_status: "pending",
        customer_email: email,
        channel,
      });
      
      if (insertOrderError) {
        console.error("Supabase Order Creation Error:", insertOrderError.message);
      }
    }

    // --- SAFELY EXTRACT IMAGE SOURCE (Only if it's NOT a pure category request) ---
    let finalImageUrl = null;
    if (!isCategoryIntent) {
      if (typeof data?.image_url === "string") {
        finalImageUrl = data.image_url;
      } else if (typeof data?.productImageUrl === "string") {
        finalImageUrl = data.productImageUrl;
      } else if (typeof data?.image === "string") {
        finalImageUrl = data.image;
      } else if (Array.isArray(data?.images) && data.images[0]?.src) {
        finalImageUrl = data.images[0].src;
      }
    }

    // --- DIRECT LINK PASS-THROUGH (CRITICAL FIX) ---
    const extractedCategory = typeof data?.category === "string" ? data.category.trim() : null;
    let finalProductUrl = productUrl;

    // Only construct a backup URL if n8n didn't give us a valid url path
    if (!finalProductUrl && extractedCategory) {
      const categorySlug = extractedCategory.toLowerCase().replace(/\s+/g, "-");
      if (isCategoryIntent) {
        finalProductUrl = `${baseUrl}/product-category/${categorySlug}/`;
      } else if (data?.slug) {
        finalProductUrl = `${baseUrl}/product/${data.slug}`;
      } else {
        finalProductUrl = `${baseUrl}/product-category/${categorySlug}/`;
      }
    }

    // --- RENDER STRUCTURAL LAYOUT RULES ---
    return NextResponse.json({
      type: (isProductIntent || isCategoryIntent) ? "product" : "text",
      reply: (isProductIntent || isCategoryIntent) ? null : productMessage,
      message: productMessage,
      name: typeof data?.name === "string" ? data.name : typeof data?.product_name === "string" ? data.product_name : (extractedCategory || "Our Collection"),
      description: typeof data?.description === "string" ? data.description : null,
      price: isCategoryIntent ? null : (typeof data?.price === "number" || typeof data?.price === "string" ? data.price : null),
      image_url: finalImageUrl, 
      imageUrl: finalImageUrl,
      category: extractedCategory,
      product_url: finalProductUrl, // Sends the correct, unaltered Lovable App link now!
      payment_link: paymentLink,
      intent,
      redirect_url: redirectUrl,
    });

  } catch (error) {
    console.error("Fatal Route Failure:", error);
    return NextResponse.json({ reply: "Server error encountered." }, { status: 500 });
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