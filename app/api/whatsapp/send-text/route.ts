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

    if (!recipientNumber || !message) {
      return NextResponse.json(
        { error: "Recipient number and message are required" },
        { status: 400 }
      );
    }

    const { data: config } = await supabase
      .from("whatsapp_configs")
      .select("wa_phone_number_id, meta_access_token, chatbot_id, user_id")
      .limit(1)
      .single();

    if (!config) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    const phoneNumberId = config.wa_phone_number_id;
    const token = config.meta_access_token;

    // Send text message to Meta API
    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: recipientNumber,
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
    // 🟢 ADD HANDOFF LOGIC & OUTGOING DB LOG HERE (AFTER SUCCESSFUL SEND)
    // =========================================================================
    const cleanPhone = normalizePhone(recipientNumber);
    const conversationId = `conv_${cleanPhone}`;

    // 1. Log the human agent's outgoing response in the messages table
    try {
      await supabase.from("messages").insert([
        {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          role: "human_agent", // or "assistant" depending on your schema
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

    // 2. Mark / ensure conversation status is active in human handoff table
    try {
      await supabase.from("human_handoffs").upsert(
        [
          {
            conversation_id: conversationId,
            phone: cleanPhone,
            status: "active", // Keeps the automated bot suppressed
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "conversation_id" }
      );
    } catch (handoffErr) {
      console.error("Error updating human handoff status:", handoffErr);
    }
    // =========================================================================

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (err: any) {
    console.error(err.response?.data || err);

    return NextResponse.json(
      {
        error: err.response?.data || err.message,
      },
      { status: 500 }
    );
  }
}