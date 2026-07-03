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

const extractMarkdownUrl = (message: any): { cleanText: string; url: string | null } => {
  const text = String(message ?? '');
  
  const markdownMatch = text.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch) {
    return {
      cleanText: text.replace(markdownMatch[0], "below:"),
      url: markdownMatch[2]
    };
  }
  
  const rawUrlMatch = text.match(/(https?:\/\/[^\s]+)/);
  if (rawUrlMatch) {
    const matchedUrl = rawUrlMatch[0];
    return {
      cleanText: text.replace(matchedUrl, "").replace("at ", "below:").trim(),
      url: matchedUrl
    };
  }
  
  return { cleanText: text, url: null };
};

async function saveMessage(data: {
  user_id: string | null;
  bot_id: string | null;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  channel: "website" | "whatsapp";
  human_handoff?: string | null; 
}) {
  // Explicitly mapping out every key ensures the driver writes to your exact database row format
  const payload: Record<string, any> = {
    user_id: data.user_id,
    bot_id: data.bot_id,
    conversation_id: data.conversation_id,
    role: data.role,
    content: data.content,
    channel: data.channel,
    phone_number: null,
    external_user_id: null,
  };

  // Explicitly inject the key with the column space naming format
  if (data.human_handoff) {
    payload["human handoff"] = data.human_handoff;
  } else {
    payload["human handoff"] = null;
  }

  const { error } = await supabase
    .from("messages")
    .insert([payload]); // Passing an explicit single-item array object

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

    // 🔍 ADD THIS LOG RIGHT HERE TO SEE N8N OUTPUT IN YOUR TERMINAL:
    console.log("👉 REAL N8N DATA RECEIVED:", JSON.stringify(rawData, null, 2));

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

    // --- CLEANED EXTRACTION LOGIC ---
    let data: any = {};
    let fallbackProductsArray: any[] = [];

    if (rawData) {
      let rawString = typeof rawData === "string" ? rawData : JSON.stringify(rawData);
      
      if (rawString.includes("```")) {
        rawString = rawString.replace(/```json/gi, "")
                             .replace(/```/g, "")
                             .trim();
      }

      try {
        const parsedJson = JSON.parse(rawString);
        data = parsedJson.json || parsedJson || {};
      } catch (e) {
        console.error("Fuzzy JSON parse failed, falling back to raw mapping:", e);
        data = rawData.json || rawData || {};
      }
    }

    if (Array.isArray(rawData)) {
      fallbackProductsArray = rawData.map(item => item.json || item);
      const firstLevel = rawData[0];
      if (Array.isArray(firstLevel)) {
        data = firstLevel[0]?.json || firstLevel[0] || {};
      } else if (firstLevel && typeof firstLevel === "object") {
        data = firstLevel.json || firstLevel || {};
      }
    }

    // ⚙️ UPDATE THIS LINE INSIDE YOUR NEXT.JS ROUTE TO READ THE N8N JSON WRAPPER:
const handoffStatus = (
  data?.needsHuman === true || 
  data?.needsHuman === "true" || 
  data?.json?.needsHuman === true || 
  data?.json?.needsHuman === "true" || 
  data?.ecommerce?.needsHuman === true
) ? "pending" : null;

    // 🛡️ CRITICAL LOOP & CRASH FIX START
    // This catches scenarios where data isn't structured or where an attribute validation response text arrives
    if (data && data.intent === "validate_order" && data.message) {
      const fallbackText = data.message;
      
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
        content: fallbackText,
        channel,
        human_handoff: handoffStatus, // ◄ Add this line
      });

      return NextResponse.json({
        type: "text",
        reply: fallbackText,
        message: fallbackText,
        intent: "validate_order",
        items: data.items || []
      });
    }
    // 🛡️ CRITICAL LOOP & CRASH FIX END

    // Extract products list if available
    const products = Array.isArray(data) 
      ? data 
      : (data?.data || data?.products || fallbackProductsArray || []);

    // Check fallback text properties safely
    const fallbackText = 
      data?.reply ||
      rawData?.reply ||
      data?.message || 
      data?.custom_text || 
      rawData?.message || 
      rawData?.json?.message || 
      rawData?.custom_text ||
      "Here are some alternative items from our collection you might love:";

    const isProductIntent = data?.type === "product" || !!data?.product_name || !!data?.name;
    const isCategoryIntent = data?.type === "category" || /category|show collection|browse/i.test(userMsg);
    
    const hasValidProducts = Array.isArray(products) && products.length > 0;
    const shouldRenderCarousel = hasValidProducts && (isProductIntent || isCategoryIntent || data?.success === true || rawData?.success === true);

    // =========================================================================
    // 1. CAROUSEL RENDERING PATH (Unified Type Object Layout Fix)
    // =========================================================================
    if (shouldRenderCarousel) {
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
        content: fallbackText,
        channel,
        human_handoff: handoffStatus, // ◄ Add this line
      });

      return NextResponse.json({
        type: "carousel", 
        reply: fallbackText, 
        message: fallbackText,
        text: fallbackText,
        
        items: products.map((p: any) => ({
          name: p.name || p.product_name || "Product",
          price: p.price || null,
          image_url: p.image_url || p.imageUrl || null,
          product_url: p.product_url || p.productUrl || p.website_url || "",
          description: p.description || null
        }))
      });
    }

    // =========================================================================
    // 2. TEXT/GENERAL CHAT CONVERSATION PATH (Fixed Fallback)
    // =========================================================================
    const linkData = extractMarkdownUrl(fallbackText);
    const productMessage = linkData.cleanText;

    const paymentLink = typeof data?.payment_link === "string" ? data.payment_link : null;
    
    const detectedWebUrl = linkData.url || (typeof data?.product_url === "string" ? data.product_url : null);
    const productUrl = detectedWebUrl || (typeof data?.productUrl === "string" ? data.productUrl : null);

    let intent = null;
    let redirectUrl = typeof data?.redirect_url === "string" ? data.redirect_url : null;

    if (!redirectUrl) {
      if (/plan|billing/.test(userMsg)) {
        intent = "billing";
        redirectUrl = `${baseUrl}/dashboard/Billing`;
      } else if (/contact|support|help/.test(userMsg)) {
        intent = "support";
        redirectUrl = `${baseUrl}/contact`;
      } else if (paymentLink) {
        redirectUrl = paymentLink;
      } else if (productUrl) {
        redirectUrl = productUrl;
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
      human_handoff: handoffStatus, // ◄ Add this line
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

    const extractedCategory =
      typeof data?.category === "string" ? data.category.trim() : null;

    let finalProductUrl = "";
    if (typeof productUrl === "string") {
      finalProductUrl = productUrl.trim();
    }

    return NextResponse.json({
      type: isProductIntent || isCategoryIntent ? "product" : "text",
      reply: productMessage, 
      message: productMessage,
      name: isProductIntent || isCategoryIntent ? (data?.name || data?.product_name || extractedCategory) : null,
      description: isProductIntent || isCategoryIntent ? (data?.description || null) : null,
      price: isProductIntent ? (data?.price || null) : null,
      
      image_url: isProductIntent || isCategoryIntent ? finalImageUrl : null,
      imageUrl: isProductIntent || isCategoryIntent ? finalImageUrl : null,
      productImageUrl: isProductIntent || isCategoryIntent ? finalImageUrl : null,
      
      product_url: isProductIntent || isCategoryIntent ? finalProductUrl : "",
      payment_link: paymentLink,
      intent: data?.intent || intent,
      actionUrl: redirectUrl || paymentLink || finalProductUrl || undefined,
      actionLabel: data?.actionLabel || (paymentLink ? "Pay Now" : "Open Page"),
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