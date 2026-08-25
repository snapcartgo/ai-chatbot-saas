import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  console.log("===== ONBOARD ROUTE: COEXISTENCE AUTO-SYNC =====");
  try {
    const body = await req.json();

    const client_id = String(body.client_id || "").trim();
    let waba_id = String(body.waba_id || "").trim();
    let phone_number_id = String(body.phone_number_id || "").trim();
    const business_id = String(body.business_id || "").trim();
    const auth_code = String(body.access_token || "").trim();

    if (!client_id) {
      return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
    }

    // 1. Exchange OAuth code for a long-lived user/system token
    let finalAccessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
    const metaAppSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

    if (auth_code && auth_code.length > 15 && metaAppSecret) {
      try {
        const tokenRes = await axios.get("https://graph.facebook.com/v21.0/oauth/access_token", {
          params: {
            client_id: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID,
            client_secret: metaAppSecret,
            code: auth_code,
          },
        });
        if (tokenRes.data?.access_token) {
          finalAccessToken = tokenRes.data.access_token;
        }
      } catch (tokenErr: any) {
        console.warn("OAuth token exchange fallback:", tokenErr?.response?.data || tokenErr.message);
      }
    }

    if (!finalAccessToken) {
      return NextResponse.json(
        { error: "Server configuration error: Missing WhatsApp Access Token" },
        { status: 500 }
      );
    }

    // 2. Fallback discovery if waba_id wasn't in popup payload
    if (!waba_id && finalAccessToken) {
      try {
        const debugRes = await axios.get("https://graph.facebook.com/v21.0/debug_token", {
          params: {
            input_token: finalAccessToken,
            access_token: `${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}|${metaAppSecret}`,
          },
        });
        const waScope = debugRes.data?.data?.granular_scopes?.find(
          (s: any) => s.scope === "whatsapp_business_management"
        );
        if (waScope?.target_ids?.length > 0) {
          waba_id = waScope.target_ids[0];
        }
      } catch (err: any) {
        console.warn("WABA auto-discovery failed:", err?.message);
      }
    }

    // 3. Automatically query Meta Graph API for Phone Number & Phone Number ID
    let resolvedPhoneNumber = "";
    if (waba_id) {
      try {
        const phoneListRes = await axios.get(
          `https://graph.facebook.com/v21.0/${waba_id}/phone_numbers`,
          {
            headers: { Authorization: `Bearer ${finalAccessToken}` },
          }
        );

        const phoneList = phoneListRes.data?.data || [];
        if (phoneList.length > 0) {
          const matchedPhone = phone_number_id
            ? phoneList.find((p: any) => p.id === phone_number_id) || phoneList[0]
            : phoneList[0];

          phone_number_id = matchedPhone.id;
          resolvedPhoneNumber = (matchedPhone.display_phone_number || "").replace(/\s+/g, "");
        }

        // 4. Subscribe the WABA to Webhooks
        await axios.post(
          `https://graph.facebook.com/v21.0/${waba_id}/subscribed_apps`,
          {},
          { headers: { Authorization: `Bearer ${finalAccessToken}` } }
        );
      } catch (graphErr: any) {
        console.warn("Failed fetching phone details from Graph API:", graphErr?.response?.data || graphErr.message);
      }
    }

    if (!waba_id || !phone_number_id) {
      return NextResponse.json(
        { error: "Could not resolve WhatsApp Business Account or Phone Number from Meta." },
        { status: 400 }
      );
    }

    // 5. Find or Create Default Chatbot
    let finalChatbotId = null;

    const { data: existingConfig } = await supabase
      .from("whatsapp_configs")
      .select("chatbot_id")
      .eq("user_id", client_id)
      .maybeSingle();

    if (existingConfig?.chatbot_id) {
      finalChatbotId = existingConfig.chatbot_id;
    }

    if (!finalChatbotId) {
      const { data: newBot, error: botError } = await supabase
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
          is_system: true,
          workflow_type: "whatsapp_only",
        })
        .select("id")
        .single();

      if (!botError && newBot) {
        finalChatbotId = newBot.id;
      }
    }

    // 6. Update whatsapp_configs Table
    await supabase.from("whatsapp_configs").upsert(
      {
        user_id: client_id,
        chatbot_id: finalChatbotId,
        waba_id: waba_id,
        business_id: business_id || waba_id,
        wa_phone_number_id: phone_number_id,
        phone_number: resolvedPhoneNumber,
        whatsapp_access_token: finalAccessToken,
        status: "active",
        automation_enabled: true,
        workflow_type: "whatsapp_only",
      },
      { onConflict: "user_id" }
    );

    // 7. Update whatsapp_subscriptions Table (For the Dashboard)
    if (finalChatbotId) {
      await supabase.from("whatsapp_subscriptions").upsert(
        {
          chatbot_id: finalChatbotId,
          wa_phone_number: resolvedPhoneNumber,
          wa_phone_number_id: phone_number_id,
          waba_id: waba_id,
          status: "active",
        },
        { onConflict: "chatbot_id" }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        phone_number: resolvedPhoneNumber,
        phone_number_id: phone_number_id,
        waba_id: waba_id,
      },
    });
  } catch (err: any) {
    console.error("ONBOARD ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}