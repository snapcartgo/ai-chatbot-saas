import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

// =====================================
// GET = META WEBHOOK VERIFICATION
// =====================================
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

// =====================================
// POST = RECEIVE WHATSAPP MESSAGES
// =====================================
export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("META WEBHOOK:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Ignore non-message events
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

    // =====================================
    // VALIDATE PHONE NUMBER ID
    // =====================================
    if (!/^\d+$/.test(phoneNumberId)) {
      console.error("Invalid phone number ID");
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // =====================================
    // FETCH CLIENT CONFIG
    // =====================================
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("wa_phone_number_id", phoneNumberId)
      .single();

    if (configErr || !config) {
      console.error("Config lookup failed:", configErr);
      return new Response("EVENT_RECEIVED", { status: 200 });
    }

    // =====================================
    // STABLE CONVERSATION ID
    // =====================================
    const cleanPhone = normalizePhone(customerPhone);
    const conversationId = `conv_${cleanPhone}`;

    // =====================================
    // SEND TO N8N (Core Automation Engine)
    // =====================================
    const N8N_WEBHOOK = process.env.N8N_WHATSAPP_WEBHOOK_URL || "";

    if (N8N_WEBHOOK) {
      try {
        const parsedUrl = new URL(N8N_WEBHOOK);
        
        // 💡 UPDATED: Dynamically checks your environment URL or defaults to snapcartgo
        const allowedHost = process.env.N8N_ALLOWED_HOST || "n8n.snapcartgo.com";

        if (parsedUrl.protocol === "https:" && (parsedUrl.hostname === allowedHost || parsedUrl.hostname.includes("ngrok"))) {
          await fetch(N8N_WEBHOOK, {
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
          console.log("Successfully forwarded payload straight to n8n canvas!");
        } else {
          console.warn(`Webhook blocked: Domain mismatch. Hostname was: ${parsedUrl.hostname}`);
        }
      } catch (urlErr) {
        console.error("Invalid N8N Webhook URL structure configured:", urlErr);
      }
    }

    // =====================================
    // FETCH BOT & LEAD DATA (For Database Context)
    // =====================================
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

    // =====================================
    // AI RESPONSE / META REPLY CODES
    // =====================================
    // Note: Since your intricate n8n canvas handles the business logic, checking availability,
    // and sending custom replies via your workflow nodes, you can let n8n handle the direct 
    // WhatsApp Meta API response push. If you want Next.js to do a direct fall-back answer 
    // alongside it, your OpenAI loop below remains safe and active.

    if (process.env.OPENAI_API_KEY) {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: bot?.prompt || "You are a helpful assistant.",
            },
            {
              role: "user",
              content: `Customer Context:\n${JSON.stringify(lead || "New Customer")}\n\nMessage:\n${userMessage}`,
            },
          ],
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          return data?.choices?.[0]?.message?.content || "Processing your request via automation...";
        })
        .catch((err) => {
          console.error("OpenAI Error:", err);
          return "";
        });

      if (aiResponse) {
        const metaUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
        await fetch(metaUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: customerPhone,
            type: "text",
            text: {
              preview_url: false,
              body: aiResponse,
            },
          }),
        }).catch((err) => console.error("Meta direct reply error:", err));
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}