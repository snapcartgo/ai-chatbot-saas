import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
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

export async function POST(req: NextRequest) { // <--- Changed from Request to NextRequest
  try {
    const body = await req.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) {
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // 2. Wrap your background execution in req.waitUntil()
    // This tells Vercel: "Keep the CPU alive until this background promise finishes!"
    if (typeof (req as any).waitUntil === "function") {
      (req as any).waitUntil(
        processWebhookExecution(body).catch((err) => {
          console.error("Background processing pipeline failure: ", err);
        })
      );
    } else {
      // Fallback for local testing environments where waitUntil isn't present
      processWebhookExecution(body).catch((err) => {
        console.error("Background processing pipeline failure: ", err);
      });
    }

    // 3. IMMEDIATELY REPLY TO META
    return new Response("EVENT_RECEIVED", { status: 200 });

  } catch (error) {
    console.error("Critical Webhook Parsing Crash:", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}
// 4. BACKGROUND PROCESSING PIPELINE
async function processWebhookExecution(body: any) {
  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value.messages[0];
    const customerPhone = message.from;
    const phoneNumberId = value.metadata?.phone_number_id;

    const userMessage =
      message.text?.body ||
      message.button?.text ||
      message.interactive?.button_reply?.title ||
      "Unsupported message";

    if (!customerPhone || !userMessage || !phoneNumberId || !/^\d+$/.test(phoneNumberId)) {
      return;
    }

    const { data: config, error: configErr } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("wa_phone_number_id", phoneNumberId)
      .single();

    if (configErr || !config) {
      console.error("Config lookup failed:", configErr);
      return;
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
          console.log("n8n status:", response.status);
        }
      } catch (err) {
        console.error("N8N Error:", err);
      }
    }

    const metaAccessToken = String(
      config.whatsapp_access_token || config.meta_access_token || ""
    ).trim();

    if (metaAccessToken) {
      const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

      if (Array.isArray(n8nData) && n8nData.length > 0) {
        for (const product of n8nData) {
          if (!product.image_url) continue;

          console.log("Sending array product:", product.name);
          const payload = {
            messaging_product: "whatsapp",
            to: customerPhone,
            type: "image",
            image: {
              link: product.image_url,
              caption: `${product.name}\nSKU: ${product.retailer_id || "N/A"}\nPrice: ${product.price}`,
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
          console.log("Meta Response Status:", metaRes.status);
        }
      } else if (n8nData?.image_url) {
        const payload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "image",
          image: {
            link: n8nData.image_url,
            caption: `${n8nData.name}\nPrice: ${n8nData.price}`,
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
        console.log("Single image dispatch status:", metaRes.status);
      } else if (aiResponse) {
        const payload = {
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "text",
          text: {
            body: aiResponse,
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
        console.log("Text response status:", metaRes.status);
      }
    }
  } catch (backgroundError) {
    console.error("Error inside background loop execution:", backgroundError);
  }
}