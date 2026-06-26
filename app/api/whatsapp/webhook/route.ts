import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Verification failed", { status: 403 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("META WEBHOOK:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const message = value.messages[0];
    const customerPhone = message.from;

    const userMessage =
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      "Unsupported message";

    const phoneNumberId = value.metadata?.phone_number_id;

    

    if (!customerPhone || !userMessage || !phoneNumberId) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    if (!/^\d+$/.test(phoneNumberId)) {
      console.error("Invalid phone number ID");
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const { data: config, error: configErr } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("wa_phone_number_id", phoneNumberId)
      .single();

    if (configErr || !config) {
      console.error("Config lookup failed:", configErr);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    const cleanPhone = normalizePhone(customerPhone);
    const conversationId = `conv_${cleanPhone}`;

    const N8N_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";

    let aiResponse = "";
let n8nData: any = null;

if (N8N_WEBHOOK) {
  try {
    const parsedUrl = new URL(N8N_WEBHOOK);

    if (parsedUrl.protocol === "https:") {
      const response = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bot-secret": process.env.N8N_BOT_SECRET || "",
        },
        body: JSON.stringify({
          message: userMessage,
          phone: customerPhone,
          conversation_id: conversationId,
          chatbot_id: config.chatbot_id,
          user_id: config.user_id,
          profile_name: value.contacts?.[0]?.profile?.name || "Customer",
          role: "user",
        }),
      });

      n8nData = await response.json();
      console.log("N8N DATA:", JSON.stringify(n8nData, null, 2));
console.log("AI RESPONSE:", n8nData.reply);
      

      console.log("n8nData:", JSON.stringify(n8nData));

      

aiResponse =
  n8nData?.reply ||
  n8nData?.[0]?.reply ||
  "";

      console.log("n8n status:", response.status);
    }
  } catch (err) {
    console.error("N8N Error:", err);
  }
}

    const { data: bot } = await supabase
      .from("chatbots")
      .select("*")
      .eq("id", config.chatbot_id)
      .single();

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("phone", cleanPhone)
      .single();

    const metaAccessToken = String(
  config.whatsapp_access_token || config.whatsapp_access_token || config.meta_access_token || ""
).trim();

console.log("Saved WhatsApp Token:", config.whatsapp_access_token);
console.log("Phone Number ID:", config.wa_phone_number_id);
console.log("Chatbot ID:", config.chatbot_id);

if (metaAccessToken) {
  const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const product = Array.isArray(n8nData)
    ? n8nData[0]
    : n8nData;

  let payload: any;

  if (product?.image_url) {
    payload = {
      messaging_product: "whatsapp",
      to: customerPhone,
      type: "image",
      image: {
        link: product.image_url,
        caption: `${product.name}\nPrice: ${product.price}`,
      },
    };
  } else if (aiResponse) {
    payload = {
      messaging_product: "whatsapp",
      to: customerPhone,
      type: "text",
      text: {
        body: aiResponse,
      },
    };
  }

  if (payload) {
    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("META STATUS:", metaRes.status);
    console.log("META BODY:", await metaRes.text());
  }
}
  

    return new Response("EVENT_RECEIVED", { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}