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
    
    // This is the "AQK..." authorization code from the frontend
    const oauthCode = String(body.access_token || "").trim();

    if (!client_id || !waba_id || !phone_number_id) {
      return NextResponse.json({ error: "Missing required onboarding fields" }, { status: 400 });
    }

    // Enforce strictly numeric IDs for security
    if (!/^\d+$/.test(phone_number_id) || !/^\d+$/.test(waba_id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    let whatsappToken = "";

    // 💡 STEP 1: Exchange the temporary "AQK..." code for a real Access Token
    if (oauthCode && oauthCode.startsWith("AQ")) {
      console.log("Exchanging Meta Auth Code for a real Access Token...");
      try {
        const tokenExchangeResponse = await axios.get(`https://graph.facebook.com/v23.0/oauth/access_token`, {
          params: {
            client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID, 
            client_secret: process.env.META_APP_SECRET, // ⚠️ Make sure this is in your env!
            code: oauthCode
          }
        });

        // This is the actual permanent token (will start with EAAB...)
        whatsappToken = tokenExchangeResponse.data.access_token;
        console.log("✅ Successfully exchanged code for real Meta Access Token.");
      } catch (exchangeError: any) {
        console.error("❌ Meta Token Exchange Failed:", exchangeError?.response?.data || exchangeError.message);
        return NextResponse.json({ 
          error: "Failed to exchange Meta authentication code", 
          details: exchangeError?.response?.data || exchangeError.message 
        }, { status: 400 });
      }
    } else {
      // Fallback to env token if no client code was passed
      whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    }

    if (!whatsappToken || whatsappToken.startsWith("n8n")) {
      return NextResponse.json({ error: "Invalid or missing final WhatsApp Access Token" }, { status: 500 });
    }

    // STEP 2: Find or create Chatbot ID logic
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

      if (bot?.id) {
        finalChatbotId = bot.id;
      }
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

    // STEP 3: Upsert into Supabase with the REAL exchanged token
    const { error: dbError } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          user_id: client_id,
          chatbot_id: finalChatbotId, 
          waba_id: waba_id,
          business_id: business_id || waba_id,
          wa_phone_number_id: phone_number_id,
          phone_number: body.phone_number,         
          whatsapp_access_token: whatsappToken, // 💡 Saves the real long token (EAAB...)
          status: "linking", 
          automation_enabled: true,
          workflow_type: "whatsapp_only",
        } as any,
        { onConflict: "user_id" }
      );

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

    // STEP 4: Secure Phone Number Registration with Meta
    try {
      const sanitizedPhoneId = encodeURIComponent(phone_number_id);
      await axios.post(
        `https://graph.facebook.com/v23.0/${sanitizedPhoneId}/register`,
        { messaging_product: "whatsapp", pin: "123456" },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (registerError: any) {
      console.warn("Registration endpoint skipped or test number warning:", registerError?.response?.data || registerError.message);
    }

    // STEP 5: Set status to active
    await supabase
      .from("whatsapp_configs")
      .update({ status: "active" } as any)
      .eq("user_id", client_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("ONBOARD ERROR:", err);
    return NextResponse.json({ error: err.message || "Invalid request" }, { status: 400 });
  }
}