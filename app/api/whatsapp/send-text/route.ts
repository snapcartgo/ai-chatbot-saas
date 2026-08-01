import { NextResponse } from "next/server";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const recipientNumber = String(body.recipient_number || "").trim();
    const message = String(body.message || "").trim();
    
    // 🟢 Read user_id or wa_phone_number_id passed dynamically from the frontend body
    const userId = body.user_id ? String(body.user_id).trim() : null;
    const inputPhoneNumberId = body.wa_phone_number_id ? String(body.wa_phone_number_id).trim() : null;

    if (!recipientNumber || !message) {
      return NextResponse.json(
        { error: "Recipient number and message are required" },
        { status: 400 }
      );
    }

    // 🟢 DYNAMIC QUERY: Query specifically by user_id or phone_number_id
    let query = supabase
      .from("whatsapp_configs")
      .select("wa_phone_number_id, whatsapp_access_token, chatbot_id, user_id");

    if (userId) {
      query = query.eq("user_id", userId);
    } else if (inputPhoneNumberId) {
      query = query.eq("wa_phone_number_id", inputPhoneNumberId);
    } else {
      // Fallback: search for the first record that actually has a valid Meta Access Token (EAA...)
      query = query.like("whatsapp_access_token", "EAA%");
    }

    const { data: config, error: configError } = await query.limit(1).maybeSingle();

    if (configError || !config) {
      console.error("Supabase Config Fetch Error:", configError);
      return NextResponse.json(
        { error: "Valid WhatsApp configuration not found for this user" },
        { status: 404 }
      );
    }

    const phoneNumberId = String(config.wa_phone_number_id || "").trim();
    
    // Clean token string retrieved for this user
    let token = String(config.whatsapp_access_token || "").trim();
    token = token.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");

    if (!phoneNumberId || !token || token === "NULL" || !token.startsWith("EAA")) {
      return NextResponse.json(
        { error: "Invalid token or phone_number_id found in user config" },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(recipientNumber);

    console.log("Matched User ID:", config.user_id);
    console.log("Sending via Phone ID:", phoneNumberId);

    // Send text message to Meta API
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: {
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // =========================================================================
    // 🟢 DB LOGGING & HANDOFF
    // =========================================================================
    const conversationId = `conv_${cleanPhone}`;

    try {
      await supabase.from("messages").insert([
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          role: "human_agent",
          content: message,
          channel: "whatsapp",
          phone_number: cleanPhone,
          ...(config?.chatbot_id && { bot_id: config.chatbot_id }),
          ...(config?.user_id && { user_id: config.user_id }),
        },
      ]);
    } catch (dbErr) {
      console.error("Error logging agent message to DB:", dbErr);
    }

    try {
      await supabase.from("human_handoffs").upsert(
        [
          {
            conversation_id: conversationId,
            phone: cleanPhone,
            status: "active",
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "conversation_id" }
      );
    } catch (handoffErr) {
      console.error("Error updating human handoff status:", handoffErr);
    }

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (err: any) {
    const errorDetails = err.response?.data || err.message;
    console.error("Meta Send Text Failure:", JSON.stringify(errorDetails, null, 2));

    return NextResponse.json(
      { error: errorDetails },
      { status: 500 }
    );
  }
}