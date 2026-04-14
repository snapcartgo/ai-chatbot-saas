import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sanitizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

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

    const message = body.message;
    const bot_id = body.bot_id || body.chatbotId || body.activeBotId;
    const conversation_id =
      body.conversation_id || body.sessionId || crypto.randomUUID();
    const category = body.category || "general";

    // Optional e-commerce fields
    const { user_id, product_name, price, email } = body;

    if (!message || !bot_id) {
      return NextResponse.json(
        { reply: "Error: Message or Bot ID is missing in the request." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { reply: "Webhook URL is not configured." },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
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

    let botReply: string = data.reply || data.output || "No response";
    let paymentLink: string | null = data.payment_link || null;
    let intent: string | null = null;
    let redirectUrl: string | null = null;

    // Handle AI output when returned as JSON string/object
    const parsedOutput =
      typeof data.output === "string"
        ? (() => {
            try {
              return JSON.parse(data.output);
            } catch {
              return null;
            }
          })()
        : typeof data.output === "object" && data.output !== null
        ? data.output
        : null;

    if (parsedOutput) {
      if (parsedOutput.intent) intent = String(parsedOutput.intent).toLowerCase();
      if (parsedOutput.message) botReply = String(parsedOutput.message);
      if (parsedOutput.payment_link) paymentLink = String(parsedOutput.payment_link);

      // Bot-specific redirect from webhook/AI output (preferred)
      if (!redirectUrl && parsedOutput.redirect_url) {
        redirectUrl = sanitizeHttpUrl(parsedOutput.redirect_url);
      }
      if (!redirectUrl && parsedOutput.action_url) {
        redirectUrl = sanitizeHttpUrl(parsedOutput.action_url);
      }
    }

    // Bot-specific redirect from top-level webhook response
    if (!redirectUrl && data.redirect_url) {
      redirectUrl = sanitizeHttpUrl(data.redirect_url);
    }
    if (!redirectUrl && data.action_url) {
      redirectUrl = sanitizeHttpUrl(data.action_url);
    }

    // Optional legacy fallback (OFF by default)
    // Set ENABLE_GLOBAL_KEYWORD_REDIRECTS=true only if you explicitly want old behavior.
    const userMsg = String(message).toLowerCase();
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://ai-chatbot-saas-five.vercel.app";
    const enableLegacyKeywordRedirects =
      process.env.ENABLE_GLOBAL_KEYWORD_REDIRECTS === "true";

    if (!redirectUrl && enableLegacyKeywordRedirects) {
      if (
        intent === "billing" ||
        intent === "plan" ||
        /plan|pricing|price|billing|subscription/.test(userMsg)
      ) {
        redirectUrl = `${baseUrl}/dashboard/Billing`;
      } else if (
        intent === "contact" ||
        intent === "support" ||
        /contact|support|help team|customer care/.test(userMsg)
      ) {
        redirectUrl = `${baseUrl}/contact`;
      }
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

    // Keep existing order insert behavior
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
        intent,
        redirect_url: redirectUrl,
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    console.error("Webhook Error:", error);

    return NextResponse.json(
      { reply: "Connection error." },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
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
