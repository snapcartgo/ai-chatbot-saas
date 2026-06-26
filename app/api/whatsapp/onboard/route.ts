import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const client_id = String(body.client_id || "").trim();
    const waba_id = String(body.waba_id || "").trim();
    const phone_number_id = String(body.phone_number_id || "").trim();
    const business_id = String(body.business_id || "").trim();
    const oauthCode = String(body.access_token || "").trim();

    if (!client_id || !waba_id || !phone_number_id) {
      return NextResponse.json({ error: "Missing required onboarding fields" }, { status: 400 });
    }

    if (!/^\d+$/.test(phone_number_id) || !/^\d+$/.test(waba_id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    let finalSystemAccessToken = "";

    // 💡 AUTOMATIC EXCHANGE: Convert the code into the real permanent chatbot token
    if (oauthCode && oauthCode.startsWith("AQ")) {
      try {
        const tokenExchangeResponse = await axios.get(`https://graph.facebook.com/v23.0/oauth/access_token`, {
          params: {
            client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID, 
            client_secret: process.env.META_APP_SECRET, 
            code: oauthCode,
            redirect_uri: ""
          }
        });
        finalSystemAccessToken = tokenExchangeResponse.data.access_token;
      } catch (exchangeError: any) {
        console.error("❌ Meta Token Exchange Failed:", exchangeError?.response?.data || exchangeError.message);
        return NextResponse.json({ 
          error: "Failed to exchange Meta authentication code. Verify your META_APP_SECRET setting.", 
          details: exchangeError?.response?.data || exchangeError.message 
        }, { status: 400 });
      }
    } else {
      finalSystemAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    }

    if (!finalSystemAccessToken || finalSystemAccessToken.includes("n8n")) {
      return NextResponse.json({ error: "System configured an invalid token fallback context" }, { status: 500 });
    }

    let finalChatbotId: string | null = null;
    const { data: existingConfig } = await supabase
      .from("whatsapp_configs")
      .select("chatbot_id")
      .eq("user_id", client_id)
      .maybeSingle();

    if (existingConfig?.chatbot_id) {
      finalChatbotId = existingConfig.chatbot_id;
    }

    if (!finalChatbotId) {
      const { data: bot } = await supabase
        .from("chatbots")
        .select("id")
        .eq("user_id", client_id)
        .eq("workflow_type", "whatsapp_only")
        .maybeSingle();
      if (bot?.id) finalChatbotId = bot.id;
    }

    if (!finalChatbotId) {
      const { data: newBot, error: botErr } = await supabase
        .from("chatbots")
        .insert({
          user_id: client_id,
          name: "WhatsApp AI Bot",
          welcome_message: "Hello! How can I help you today?",
          model: "gpt-4o-mini",
          temperature: 0.7,
          active: true,
          category: "booking",
          source: "whatsapp",
          workflow_type: "whatsapp_only",
          is_system: true,
        })
        .select("id")
        .single();

      if (botErr) return NextResponse.json({ error: botErr.message }, { status: 500 });
      finalChatbotId = newBot.id;
    }

    // 💡 SAVE TO SUPABASE
    const { error: dbError } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          user_id: client_id,
          chatbot_id: finalChatbotId, 
          waba_id: waba_id,
          business_id: business_id || waba_id,
          wa_phone_number_id: phone_number_id,
          phone_number: body.phone_number || null,         
          whatsapp_access_token: finalSystemAccessToken, 
          status: "active", 
          automation_enabled: true,
          workflow_type: "whatsapp_only",
        } as any,
        { onConflict: "user_id" }
      );

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

    try {
      const sanitizedPhoneId = encodeURIComponent(phone_number_id);
      await axios.post(
        `https://graph.facebook.com/v23.0/${sanitizedPhoneId}/register`,
        { messaging_product: "whatsapp", pin: "123456" },
        {
          headers: {
            Authorization: `Bearer ${finalSystemAccessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (registerError: any) {
      console.warn("Register step warning handled safely.");
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request processing sequence" }, { status: 400 });
  }
}