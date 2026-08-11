import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role Key to bypass RLS in webhooks
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

    // =========================================================================
    // 🛡️ IMMEDIATE DEDUPLICATION LOCK
    // =========================================================================
    if (messageId) {
      // 1. Check if message was already processed
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", messageId)
        .maybeSingle();

      if (existingMsg) {
        console.log(`⚠️ Duplicate Meta retry blocked for messageId: ${messageId}`);
        return new Response("EVENT_RECEIVED", { status: 200 });
      }

      // 2. Immediately lock/mark this message in Supabase so retries get blocked
      await supabase.from("messages").insert({
        whatsapp_message_id: messageId,
        content: message.text?.body || "User sent media/interactive",
        sender: "customer",
      });
    }
    // =========================================================================

    const customerPhone = message.from;
    const messageType = message?.type;

    // Extract context (replied/quoted message info)
    const context = message?.context;
    const quotedMessageId = context?.id || null;
    const referredProductSku = context?.referred_product?.product_retailer_id || null;

    // Extract Message Content
    let userMessage = "";
    let mediaId = "";

    if (messageType === "text") {
      userMessage = message.text?.body || "";
    } else if (messageType === "interactive") {
      // Intentionally left available for interactive payloads
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

    // Lookup WhatsApp Configs for bot_id & user_id
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("wa_phone_number_id", phoneNumberId)
      .single();

    if (configErr || !config) {
      console.error("Config lookup failed:", configErr);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // ACCESSIBLE GLOBAL VARIABLE SCOPING FOR BOTH BLOCKS
    const metaAccessToken = String(
      config.whatsapp_access_token || config.meta_access_token || ""
    ).trim();

    const cleanPhone = normalizePhone(customerPhone);
    const conversationId = `conv_${cleanPhone}`;

    // =========================================================================
    // 🟢 1. ALWAYS SAVE USER MESSAGE TO SUPABASE FIRST (Shows in Realtime Inbox)
    // =========================================================================
    try {
      const userPayload: any = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: "user",
        content: userMessage,
        channel: "whatsapp",
        whatsapp_message_id: messageId,
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

    // =========================================================================
    // 🛡️ 2. ACCURATE HUMAN MODE CHECK (ONLY BLOCKS N8N WORKFLOW)
    // =========================================================================
    let aiMode = "active";

    try {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id, ai_mode")
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.+${cleanPhone},phone.eq.${cleanPhone}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversation) {
        aiMode = conversation.ai_mode;
      }
    } catch (dbError) {
      console.error("Supabase check failed:", dbError);
    }

    if (aiMode === "human") {
      console.log(`[HANDOFF ACTIVE] Human Mode active for ${customerPhone}. Message saved to inbox, skipping n8n workflow.`);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // =========================================================================
    // 🤖 3. AI MODE IS ACTIVE: CALL N8N WORKFLOW
    // =========================================================================
    const N8N_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";

    let aiResponse = "";
    let n8nData: any = null;
    let isHumanRequired = false;

    if (N8N_WEBHOOK) {
      try {
        const parsedUrl = new URL(N8N_WEBHOOK);

        if (parsedUrl.protocol === "https:") {
          let resolvedMediaUrl = "";

          // 🟢 1. FETCH QUOTED TEXT (Supports both Supabase UUID 'id' and 'whatsapp_message_id')
          let quotedText = "";

          if (quotedMessageId) {
            // 1. First try looking up by primary key 'id'
            const { data: byId } = await supabase
              .from("messages")
              .select("content")
              .eq("id", quotedMessageId)
              .maybeSingle();

            if (byId?.content) {
              quotedText = byId.content;
            } else {
              // 2. If not found by 'id', try looking up by 'whatsapp_message_id'
              const { data: byWaId } = await supabase
                .from("messages")
                .select("content")
                .eq("whatsapp_message_id", quotedMessageId)
                .maybeSingle();

              if (byWaId?.content) {
                quotedText = byWaId.content;
              }
            }
          }

          console.log("FOUND QUOTED TEXT:", quotedText);

          // 🟢 2. SSRF SECURITY CHECK FOR MEDIA
          const matches = mediaId ? mediaId.match(/^[a-zA-Z0-9]+$/) : null;

          if (matches && metaAccessToken) {
            const sanitizedMediaId = matches[0];
            try {
              const metaMediaUrl = new URL("https://graph.facebook.com/v20.0/");
              metaMediaUrl.pathname = `/v20.0/${sanitizedMediaId}`;

              const metaMediaRes = await fetch(metaMediaUrl.toString(), {
                headers: { Authorization: `Bearer ${metaAccessToken}` },
              });
              const mediaData = await metaMediaRes.json();
              resolvedMediaUrl = mediaData?.url || "";
            } catch (mediaErr) {
              console.error("Error resolving Meta media URL:", mediaErr);
            }
          }

          // 🟢 3. CALL N8N WEBHOOK WITH ALL QUOTED METADATA
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
              media_url: resolvedMediaUrl,
              quoted_message_id: quotedMessageId,
              quoted_text: quotedText,
              referred_product_sku: referredProductSku,
            }),
          });

          n8nData = await response.json();

          aiResponse =
            n8nData?.reply ||
            n8nData?.[0]?.reply ||
            n8nData?.text?.body ||
            "";

          // Check if n8n flagged needsHuman as true
          isHumanRequired = n8nData?.needsHuman === true || n8nData?.[0]?.needsHuman === true;
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

      // -----------------------------------------------------------------
      // 1. EXTRACT AND SEND BODY_TEXT FIRST
      // -----------------------------------------------------------------
      let textBody = aiResponse;

      // Check if n8n returned an array with a `body_text` property
      if (!textBody && Array.isArray(n8nData) && n8nData.length > 0) {
        textBody = n8nData[0]?.body_text || n8nData[0]?.reply || "";
      } else if (!textBody && typeof n8nData === "object") {
        textBody = n8nData?.body_text || n8nData?.reply || n8nData?.text?.body || "";
      }

      // If textBody exists, send it to Meta
      if (textBody) {
        const textPayload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "text",
          text: { body: textBody },
        };

        const textRes = await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(textPayload),
        });

        // 🟢 Extract wamid from Meta's response
        const metaResponseJson = await textRes.json();
        const sentWamid = metaResponseJson?.messages?.[0]?.id || null;

        // Save to Supabase WITH whatsapp_message_id
        await supabase.from("messages").insert([
          {
            conversation_id: conversationId,
            role: "assistant",
            content: textBody,
            channel: "whatsapp",
            phone_number: cleanPhone,
            bot_id: config.chatbot_id,
            user_id: config.user_id,
            whatsapp_message_id: sentWamid,
            human_handoff: isHumanRequired,
          },
        ]);
      }

      // -----------------------------------------------------------------
      // 2. SEND PRODUCT IMAGES (FIXED)
      // -----------------------------------------------------------------
      if (Array.isArray(n8nData) && n8nData.length > 0) {
        for (const product of n8nData) {
          if (!product.image_url) continue;

          // Build text specific ONLY to this item
          const productLink = product.product_url || product.website_url || "";
          const linkText = productLink ? `\nLink: ${productLink}` : "";
          const assistantText = `${product.name || ""}\nSKU: ${product.retailer_id || ""}\nPrice: ${product.price || ""}${linkText}`.trim();

          const imagePayload = {
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
            body: JSON.stringify(imagePayload),
          });

          const metaImageJson = await metaRes.json();
          const sentImageWamid = metaImageJson?.messages?.[0]?.id || null;

          // Insert unique record per product directly into Supabase
          await supabase.from("messages").insert([
            {
              conversation_id: conversationId,
              role: "assistant",
              content: `[Sent Image: ${assistantText}]`,
              channel: "whatsapp",
              phone_number: cleanPhone,
              bot_id: config.chatbot_id,
              user_id: config.user_id,
              image_url: product.image_url,
              whatsapp_message_id: sentImageWamid,
            },
          ]);
        }
      }

      // -----------------------------------------------------------------
      // 3. SEND AUDIO / VOICE NOTE
      // -----------------------------------------------------------------
      let rawAudioId = n8nData?.media_id || (Array.isArray(n8nData) && n8nData[0]?.media_id) || "";
      const cleanAudioId = String(rawAudioId).replace(/[^0-9]/g, "");

      const n8nAudioUrl = n8nData?.audio_url || (Array.isArray(n8nData) && n8nData[0]?.audio_url) || "";

      if (cleanAudioId || n8nAudioUrl) {
        const audioPayload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "audio",
          audio: cleanAudioId
            ? { id: cleanAudioId }
            : { link: String(n8nAudioUrl).trim() },
        };

        const audioRes = await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(audioPayload),
        });

        const metaAudioJson = await audioRes.json();
        console.log("META AUDIO RESPONSE:", JSON.stringify(metaAudioJson, null, 2));

        const sentAudioWamid = metaAudioJson?.messages?.[0]?.id || null;

        if (sentAudioWamid) {
          await supabase.from("messages").insert([
            {
              conversation_id: conversationId,
              role: "assistant",
              content: "[Sent Audio]",
              channel: "whatsapp",
              phone_number: cleanPhone,
              bot_id: config.chatbot_id,
              user_id: config.user_id,
              whatsapp_message_id: sentAudioWamid,
            },
          ]);
        }
      } else if (n8nData?.image_url) {
        const productLink = n8nData.product_url || n8nData.website_url || "";
        const linkText = productLink ? `\nLink: ${productLink}` : "";
        const assistantText = `${n8nData.name || ""}\nPrice: ${n8nData.price || ""}${linkText}`.trim();

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
            image_url: n8nData.image_url,
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