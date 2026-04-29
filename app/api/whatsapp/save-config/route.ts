import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const authClient = createClient(supabaseUrl, supabaseAnonKey);
const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

type Body = {
  twilio_sid: string;
  twilio_auth_token: string;
  phone_number: string;
  category: "booking" | "ecommerce";
  chatbot_id?: string | null;
};

function buildWhatsappBotName(category: string) {
  return category === "ecommerce"
    ? "WhatsApp Ecommerce Bot"
    : "WhatsApp Booking Bot";
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized user" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as Body;

    const twilio_sid = body.twilio_sid?.trim() || "";
    const twilio_auth_token = body.twilio_auth_token?.trim() || "";
    const phone_number = body.phone_number?.trim() || "";
    const category = body.category === "ecommerce" ? "ecommerce" : "booking";
    const requestedChatbotId = body.chatbot_id?.trim() || null;

    if (!twilio_sid || !twilio_auth_token || !phone_number) {
      return NextResponse.json(
        { error: "Twilio SID, Auth Token, and phone number are required" },
        { status: 400 }
      );
    }

    const { data: existingConfig, error: existingConfigError } = await adminClient
      .from("whatsapp_configs")
      .select("id, chatbot_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingConfigError) {
      return NextResponse.json(
        { error: existingConfigError.message },
        { status: 500 }
      );
    }

    let finalChatbotId = requestedChatbotId || existingConfig?.chatbot_id || null;

    if (finalChatbotId) {
      const { data: linkedBot, error: linkedBotError } = await adminClient
        .from("chatbots")
        .select("id, user_id, source, is_system")
        .eq("id", finalChatbotId)
        .maybeSingle();

      if (linkedBotError) {
        return NextResponse.json(
          { error: linkedBotError.message },
          { status: 500 }
        );
      }

      if (!linkedBot || linkedBot.user_id !== user.id) {
        return NextResponse.json(
          { error: "Invalid chatbot selected" },
          { status: 400 }
        );
      }
    }

    if (!finalChatbotId) {
      const { data: newBot, error: newBotError } = await adminClient
        .from("chatbots")
        .insert({
          user_id: user.id,
          name: buildWhatsappBotName(category),
          welcome_message:
            category === "ecommerce"
              ? "Hello! How can I help you with products today?"
              : "Hello! How can I help you with bookings today?",
          model: "gpt-4o-mini",
          temperature: 0.7,
          active: true,
          category,
          source: "whatsapp",
          is_system: true,
        })
        .select("id")
        .single();

      if (newBotError || !newBot) {
        return NextResponse.json(
          { error: newBotError?.message || "Failed to create WhatsApp chatbot" },
          { status: 500 }
        );
      }

      finalChatbotId = newBot.id;
    } else {
      const { error: updateBotError } = await adminClient
        .from("chatbots")
        .update({
          category,
          source: "whatsapp",
        })
        .eq("id", finalChatbotId)
        .eq("user_id", user.id);

      if (updateBotError) {
        return NextResponse.json(
          { error: updateBotError.message },
          { status: 500 }
        );
      }
    }

    const { error: saveConfigError } = await adminClient
      .from("whatsapp_configs")
      .upsert(
        {
          user_id: user.id,
          twilio_sid,
          twilio_auth_token,
          phone_number,
          category,
          chatbot_id: finalChatbotId,
          workflow_type: "whatsapp_only",
        },
        { onConflict: "user_id" }
      );

    if (saveConfigError) {
      return NextResponse.json(
        { error: saveConfigError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chatbot_id: finalChatbotId,
      message: "WhatsApp settings saved successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
