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
    const messageId = message?.id;

    console.log("Message ID:", messageId);
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

    // ==========================================
    // 1. SAVE USER MESSAGE TO SUPABASE
    // ==========================================
    const { error: userMsgErr } = await supabase.from("messages").insert([
      {
        conversation_id: conversationId,
        role: "user",
        content: userMessage,
        channel: "whatsapp",
        phone_number: cleanPhone,
        bot_id: config.chatbot_id,
        whatsapp_message_id: messageId,
        user_id: config.user_id
      },
    ]);
    if (userMsgErr) console.error("Error saving user message:", userMsgErr);

    const N8N_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";

    let aiResponse = "";
    let n8nData: any = null;

    if (N8N_WEBHOOK) {
      try {
        const parsedUrl = new URL(N8N_WEBHOOK);

        if (parsedUrl.protocol === "https:") {
          console.log("Calling n8n for:", message.id);
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
          aiResponse = n8nData?.reply || n8nData?.[0]?.reply || "";
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
      config.whatsapp_access_token || config.meta_access_token || ""
    ).trim();

    if (metaAccessToken) {
      const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

      if (Array.isArray(n8nData) && n8nData.length > 0) {
        let combinedAssistantContent = "";

        for (const product of n8nData) {
          if (!product.image_url) continue;

          const assistantText = `${product.name}\nSKU: ${product.retailer_id || ""}\nPrice: ${product.price}`;
          combinedAssistantContent += `[Sent Image: ${assistantText}]\n`;

          const payload = {
            messaging_product: "whatsapp",
            to: customerPhone,
            type: "image",
            image: {
              link: product.image_url,
              caption: assistantText,
            },
          };

          const metaRes = await fetch(metaUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${metaAccessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          console.log("Status product sent:", metaRes.status);
        }

        // ==========================================
        // 2a. SAVE ASSISTANT MESSAGE (PRODUCT LOOP)
        // ==========================================
        if (combinedAssistantContent) {
          await supabase.from("messages").insert([
            {
              conversation_id: conversationId,
              role: "assistant",
              content: combinedAssistantContent.trim(),
              channel: "whatsapp",
              phone_number: cleanPhone,
              bot_id: config.chatbot_id,
              user_id: config.user_id
            },
          ]);
        }

      } else if (n8nData?.image_url) {
        const assistantText = `${n8nData.name}\nPrice: ${n8nData.price}`;
        const payload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "image",
          image: {
            link: n8nData.image_url,
            caption: assistantText,
          },
        };

        await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        // ==========================================
        // 2b. SAVE ASSISTANT MESSAGE (SINGLE IMAGE)
        // ==========================================
        await supabase.from("messages").insert([
          {
            conversation_id: conversationId,
            role: "assistant",
            content: `[Sent Image: ${assistantText}]`,
            channel: "whatsapp",
            phone_number: cleanPhone,
            bot_id: config.chatbot_id,
            user_id: config.user_id
          },
        ]);

      } else if (aiResponse) {
        const payload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "text",
          text: {
            body: aiResponse,
          },
        };

        await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        // ==========================================
        // 2c. SAVE ASSISTANT MESSAGE (TEXT REPLY)
        // ==========================================
        await supabase.from("messages").insert([
          {
            conversation_id: conversationId,
            role: "assistant",
            content: aiResponse,
            channel: "whatsapp",
            phone_number: cleanPhone,
            bot_id: config.chatbot_id,
            user_id: config.user_id
          },
        ]);
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });

  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}