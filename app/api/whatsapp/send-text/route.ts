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
    const userId = body.user_id ? String(body.user_id).trim() : null;

    // 1. Validate required inputs
    if (!recipientNumber || !message) {
      return NextResponse.json(
        { error: "Recipient number and message are required." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user_id in request. Cannot determine WhatsApp configuration for this customer." },
        { status: 400 }
      );
    }

    // 2. Fetch STRICTLY for the specific customer sending the message
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("wa_phone_number_id, whatsapp_access_token, chatbot_id, user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (configError || !config) {
      console.error(`[WhatsApp API Error] Config query failed for user_id ${userId}:`, configError);
      return NextResponse.json(
        { error: `WhatsApp configuration not found for customer user_id: ${userId}` },
        { status: 404 }
      );
    }

    const phoneNumberId = String(config.wa_phone_number_id || "").trim();
    let token = String(config.whatsapp_access_token || "").trim();
    
    // Clean token string (remove outer quotes or accidental 'Bearer ' prefixes)
    token = token.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");

    // 3. Ensure this specific customer's configuration is fully set up
    if (!phoneNumberId || phoneNumberId === "EMPTY" || !token || !token.startsWith("EAA")) {
      return NextResponse.json(
        { 
          error: "Incomplete or invalid WhatsApp setup for this customer.",
          details: { wa_phone_number_id: phoneNumberId, token_valid: token.startsWith("EAA") }
        },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(recipientNumber);

    console.log(`[WhatsApp API] Sending message for Customer user_id: ${config.user_id}`);
    console.log(`[WhatsApp API] Using Phone Number ID: ${phoneNumberId}`);

    // 4. Send text message via Meta Graph API
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
    // 🟢 DB LOGGING & AUTOMATIC HANDOFF CLEARING
    // =========================================================================
    const conversationId = `conv_${cleanPhone}`;

    // 1. Log the agent's outgoing message
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

    // 2. 🔴 CLEAR ALL RED HANDOFF FLAGS FOR THIS CONVERSATION
    try {
      const { error: clearHandoffError } = await supabase
        .from("messages")
        .update({ human_handoff: false })
        .or(`conversation_id.eq.${conversationId},conversation_id.eq.${cleanPhone},phone_number.eq.${cleanPhone}`);

      if (clearHandoffError) {
        console.error("Error clearing human_handoff flag:", clearHandoffError);
      } else {
        console.log(`[WhatsApp API] Cleared human_handoff flag for ${cleanPhone}`);
      }
    } catch (clearErr) {
      console.error("Failed to clear handoff flags:", clearErr);
    }

    // 3. Update human_handoffs tracking table
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