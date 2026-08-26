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
    console.log("📥 BACKEND RECEIVED BODY:", JSON.stringify(body, null, 2)); // <-- ADD THIS HERE

    const client_id = String(body.client_id || "").trim();
    let waba_id = String(body.waba_id || "").trim();
    let phone_number_id = String(body.phone_number_id || "").trim();
    const business_id = String(body.business_id || "").trim();
    const auth_code = String(body.access_token || "").trim();
    let metaCatalogId: string | null = body.catalog_id ? String(body.catalog_id).trim() : null;
    let resolvedPhoneNumber = "";

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

    // 2. Discover WABA ID & Catalog ID from Granular Scopes
    if (finalAccessToken && metaAppSecret) {
      try {
        const debugRes = await axios.get("https://graph.facebook.com/v21.0/debug_token", {
          params: {
            input_token: finalAccessToken,
            access_token: `${process.env.NEXT_PUBLIC_FACEBOOK_APP_ID}|${metaAppSecret}`,
          },
        });

        const scopes = debugRes.data?.data?.granular_scopes || [];

        // Auto-discover WABA ID if not present
        if (!waba_id) {
          const waScope = scopes.find(
            (s: any) => s.scope === "whatsapp_business_management"
          );
          if (waScope?.target_ids?.length > 0) {
            waba_id = waScope.target_ids[0];
          }
        }

        // Extract Catalog ID directly from granted granular scopes
        if (!metaCatalogId) {
          const catalogScope = scopes.find(
            (s: any) => s.scope === "catalog_management"
          );
          if (catalogScope?.target_ids?.length > 0) {
            metaCatalogId = String(catalogScope.target_ids[0]);
            console.log("✅ Found Catalog ID from debug_token scopes:", metaCatalogId);
          }
        }
      } catch (err: any) {
        console.warn("WABA/Catalog discovery failed:", err?.message);
      }
    }

    // 3. Query Meta Graph API for Phone Number & Fallback Catalog Search
    if (waba_id && /^\d+$/.test(waba_id)) {
      const safeWabaId = encodeURIComponent(waba_id);

      try {
        const phoneListRes = await axios.get(
          `https://graph.facebook.com/v21.0/${safeWabaId}/phone_numbers`,
          { headers: { Authorization: `Bearer ${finalAccessToken}` } }
        );

        const phoneList = phoneListRes.data?.data || [];
        if (phoneList.length > 0) {
          const matchedPhone = phone_number_id
            ? phoneList.find((p: any) => p.id === phone_number_id) || phoneList[0]
            : phoneList[0];

          phone_number_id = String(matchedPhone.id);
          resolvedPhoneNumber = (matchedPhone.display_phone_number || "").replace(/\s+/g, "");
        }

        // 4. Webhook Subscription
        await axios.post(
          `https://graph.facebook.com/v21.0/${safeWabaId}/subscribed_apps`,
          {},
          { headers: { Authorization: `Bearer ${finalAccessToken}` } }
        );
      } catch (graphErr: any) {
        console.warn("Failed fetching phone details:", graphErr?.response?.data || graphErr.message);
      }

      // Method 1: Fetch via WABA product_catalogs
      if (!metaCatalogId) {
        try {
          const wabaCatRes = await axios.get(
            `https://graph.facebook.com/v21.0/${safeWabaId}/product_catalogs`,
            { headers: { Authorization: `Bearer ${finalAccessToken}` } }
          );
          const wabaCats = wabaCatRes.data?.data || [];
          if (wabaCats.length > 0 && wabaCats[0].id) {
            metaCatalogId = String(wabaCats[0].id);
            console.log("✅ Found Catalog via product_catalogs:", metaCatalogId);
          }
        } catch (err: any) {
          console.warn("WABA product_catalogs error:", err?.response?.data || err.message);
        }
      }

      // Method 2: Fetch via WhatsApp Commerce Settings
      if (!metaCatalogId && phone_number_id) {
        try {
          const phoneCommRes = await axios.get(
            `https://graph.facebook.com/v21.0/${phone_number_id}/whatsapp_commerce_settings`,
            { headers: { Authorization: `Bearer ${finalAccessToken}` } }
          );
          const commData = phoneCommRes.data?.data || [];
          if (commData.length > 0 && commData[0].catalog_id) {
            metaCatalogId = String(commData[0].catalog_id);
            console.log("✅ Found Catalog via whatsapp_commerce_settings:", metaCatalogId);
          }
        } catch (err: any) {
          console.warn("Phone commerce settings error:", err?.response?.data || err.message);
        }
      }

      // Method 3: Fetch via Business Client Product Catalogs
      if (!metaCatalogId && business_id) {
        try {
          const clientCatRes = await axios.get(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(business_id)}/client_product_catalogs`,
            { headers: { Authorization: `Bearer ${finalAccessToken}` } }
          );
          const clientCats = clientCatRes.data?.data || [];
          if (clientCats.length > 0 && clientCats[0].id) {
            metaCatalogId = String(clientCats[0].id);
            console.log("✅ Found Catalog via client_product_catalogs:", metaCatalogId);
          }
        } catch (err: any) {
          console.warn("Client catalogs check error:", err?.message);
        }
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
        meta_catalog_id: metaCatalogId,
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
          meta_catalog_id: metaCatalogId,
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
        meta_catalog_id: metaCatalogId,
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