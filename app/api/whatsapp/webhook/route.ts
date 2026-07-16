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
    const messageType = message?.type; 

    // Extract Media Information Along With Text & Audio
    let userMessage = "";
    let mediaId = "";

    if (messageType === "text") {
      userMessage = message.text?.body || "";
    } else if (messageType === "image") {
      userMessage = message.image?.caption || "User sent an image";
      mediaId = message.image?.id || "";
    } else if (messageType === "video") {
      userMessage = message.video?.caption || "User sent a video";
      mediaId = message.video?.id || "";
    } else if (messageType === "audio") {
      userMessage = "User sent an audio message";
      mediaId = message.audio?.id || "";
    } else {
      userMessage =
        message.button?.text ||
        message.interactive?.button_reply?.title ||
        "Unsupported message";
    }

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

    // 🟢 ACCESSIBLE GLOBAL VARIABLE SCOPING FOR BOTH BLOCKS
    const metaAccessToken = String(
      config.whatsapp_access_token || config.meta_access_token || ""
    ).trim();

    const cleanPhone = normalizePhone(customerPhone);
    const conversationId = `conv_${cleanPhone}`;

    // Safe DB Insert Block
    try {
      const userPayload: any = {
        id: crypto.randomUUID(), 
        conversation_id: conversationId,
        role: "user",
        content: userMessage,
        channel: "whatsapp",
        ...(config?.chatbot_id && { bot_id: config.chatbot_id }),
        ...(config?.user_id && { user_id: config.user_id }),
      };
      
      const { error: userMsgErr, data: insertedData } = await supabase
        .from("messages")
        .insert([userPayload])
        .select();

      if (userMsgErr) {
        console.error("❌ DATABASE CONSTRAINT REJECTION:", JSON.stringify(userMsgErr, null, 2));
      } else {
        console.log("✅ USER ROW INSERT SUCCESSFUL:", insertedData);
      }
    } catch (dbCatchErr) {
      console.error("❌ CODE RUNTIME CRASH DURING INSERT:", dbCatchErr);
    }

    const N8N_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";

    let aiResponse = "";
    let n8nData: any = null;

    if (N8N_WEBHOOK) {
      try {
        const parsedUrl = new URL(N8N_WEBHOOK);

        if (parsedUrl.protocol === "https:") {
          // Resolve media_id to an official Meta URL link before calling n8n
          let resolvedMediaUrl = "";
          if (mediaId && metaAccessToken) {
            try {
              const metaMediaRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
                headers: { Authorization: `Bearer ${metaAccessToken}` }
              });
              const mediaData = await metaMediaRes.json();
              resolvedMediaUrl = mediaData?.url || "";
            } catch (mediaErr) {
              console.error("Error resolving Meta media URL:", mediaErr);
            }
          }

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
              message_type: messageType,
              media_id: mediaId,
              media_url: resolvedMediaUrl 
            }),
          });

          n8nData = await response.json();

          aiResponse =
            n8nData?.reply ||
            n8nData?.[0]?.reply ||
            n8nData?.text?.body ||
            "";
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

    if (metaAccessToken) {
      const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

      if (Array.isArray(n8nData) && n8nData.length > 0) {
        let combinedAssistantContent = "";
        let firstProductImageUrl = ""; 

        for (const product of n8nData) {
          if (!product.image_url) continue;
          
          if (!firstProductImageUrl) {
            firstProductImageUrl = product.image_url;
          }

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

        if (combinedAssistantContent) {
          await supabase.from("messages").insert([
            {
              conversation_id: conversationId,
              role: "assistant",
              content: combinedAssistantContent.trim(),
              channel: "whatsapp",
              phone_number: cleanPhone,
              bot_id: config.chatbot_id,
              user_id: config.user_id,
              image_url: firstProductImageUrl 
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

        await supabase.from("messages").insert([
          {
            conversation_id: conversationId,
            role: "assistant",
            content: `[Sent Image: ${assistantText}]`,
            channel: "whatsapp",
            phone_number: cleanPhone,
            bot_id: config.chatbot_id,
            user_id: config.user_id,
            image_url: n8nData.image_url 
          },
        ]);

      } else if (aiResponse || n8nData?.type === "text") {

        const textBody =
          aiResponse ||
          n8nData?.text?.body ||
          "Sorry, we couldn't find any matching products.";

        const payload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "text",
          text: {
            body: textBody,
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

        console.log("Text message status:", metaRes.status);

        await supabase.from("messages").insert([
          {
            conversation_id: conversationId,
            role: "assistant",
            content: textBody,
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