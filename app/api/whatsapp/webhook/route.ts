import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeWhatsAppNumber(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("whatsapp:")) return value;
  if (value.startsWith("+")) return `whatsapp:${value}`;
  return `whatsapp:+${value}`;
}

export async function POST(req: Request) {
  try {
    const rawData = await req.text();
    const params = new URLSearchParams(rawData);

    const userMessage = params.get("Body");
    const customerPhone = params.get("From") || ""; // e.g., "whatsapp:+919876543210"
    const twilioAccountSid = params.get("AccountSid");

    // 1. Security Check for Twilio
    if (!twilioAccountSid || !/^AC[a-fA-F0-9]{32}$/.test(twilioAccountSid)) {
      return new Response("<Response></Response>", {
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (!userMessage) return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });

    // 2. Fetch Config from Supabase
    const { data: config, error: configErr } = await supabase
      .from("whatsapp_configs")
      .select("chatbot_id, user_id, twilio_auth_token, twilio_sid, phone_number")
      .eq("twilio_sid", twilioAccountSid)
      .single();

    if (configErr || !config) {
      console.error("Config lookup error:", configErr);
      return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
    }

    // 3. GENERATE STABLE CONVERSATION ID (Critical for your Dashboard)
    // This removes 'whatsapp:+' and leaves just the numbers, adding 'conv_' prefix
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const conversationId = `conv_${cleanPhone}`;

    // 4. --- UPDATED N8N BRIDGE ---
    // This now sends the conversation_id and user_id correctly
    if (process.env.N8N_WHATSAPP_WEBHOOK_URL) {
      await fetch(process.env.N8N_WHATSAPP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bot-secret": process.env.N8N_BOT_SECRET || "", 
        },
        body: JSON.stringify({
          message: userMessage,
          phone: customerPhone,
          conversation_id: conversationId, // Fixes 'undefined' in dashboard
          chatbot_id: config.chatbot_id,   // Fixes missing chatbot_id
          user_id: config.user_id,         // Fixes missing user_id
          profile_name: params.get("ProfileName") || "Customer",
          role: "user"
        }),
      }).catch(err => console.error("n8n Bridge Connection Error:", err));
    }

    // 5. Get Bot Prompt for AI Response
    const { data: bot } = await supabase
      .from("chatbots")
      .select("id, name, prompt")
      .eq("id", config.chatbot_id)
      .single();

    const purePhone = customerPhone.replace("whatsapp:", "");
    const { data: lead } = await supabase.from("leads").select("*").eq("phone", purePhone).single();

    // 6. AI Logic
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: bot?.prompt || "You are a helpful assistant." },
          { role: "user", content: `Customer Context: ${JSON.stringify(lead || "New Customer")}\n\nMessage: ${userMessage}` },
        ],
      }),
    })
      .then((res) => res.json())
      .then((data) => data.choices[0].message.content);

    // 7. Send Reply back via Twilio
    const twilioMessageUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilio_sid)}/Messages.json`;
    const fromNumber = normalizeWhatsAppNumber(config.phone_number) || "whatsapp:+14155238886";

    await fetch(twilioMessageUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${config.twilio_sid}:${config.twilio_auth_token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: customerPhone,
        From: fromNumber,
        Body: aiResponse,
      }),
    });

    return new Response("<Response></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Webhook Error:", error);
    return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  }
}