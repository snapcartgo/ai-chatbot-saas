import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeWhatsAppNumber(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("whatsapp:")) return value;
  if (value.startsWith("+")) return `whatsapp:${value}`;
  return `whatsapp:+${value}`;
}

function stripWhatsAppPrefix(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/^whatsapp:/, "");
}

async function saveMessage(data: {
  user_id: string;
  bot_id: string | null;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  channel: "whatsapp";
  phone_number: string;
  external_user_id: string;
  whatsapp_message_sid?: string | null;
}) {
  const { error } = await supabase.from("messages").insert(data);

  if (error) {
    console.error("WhatsApp message save error:", error);
  }
}

async function upsertLead(data: {
  user_id: string;
  conversation_id: string;
  phone: string;
  channel: "whatsapp";
}) {
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", data.user_id)
    .eq("phone", data.phone)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("leads")
      .update({
        channel: "whatsapp",
        conversation_id: data.conversation_id,
        phone_number: data.phone,
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("leads").insert({
    user_id: data.user_id,
    name: data.phone,
    phone: data.phone,
    phone_number: data.phone,
    conversation_id: data.conversation_id,
    lead_status: "new",
    channel: "whatsapp",
  });
}

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.N8N_BOT_SECRET;
    const providedSecret = req.headers.get("x-bot-secret") || "";

    if (expectedSecret && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const user_id = body.user_id || body.userId;
    const from_phone = body.from_phone || body.fromPhone || "";
    const message = body.message;
    const conversation_id =
      body.conversation_id || body.conversationId || crypto.randomUUID();
    const whatsapp_message_sid =
      body.whatsapp_message_sid || body.messageSid || body.SmsMessageSid || null;

    if (!message || !user_id) {
      return NextResponse.json(
        { error: "Missing required fields: user_id and message are required" },
        { status: 400 }
      );
    }

    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("automation_enabled, default_prompt")
      .eq("user_id", user_id)
      .maybeSingle();

    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json(
        { reply: "This WhatsApp automation is not set up yet." },
        { status: 404 }
      );
    }

    if (config.automation_enabled === false) {
      return NextResponse.json(
        { reply: "This WhatsApp assistant is currently paused." },
        { status: 200 }
      );
    }

    const normalizedFrom = normalizeWhatsAppNumber(from_phone);
    const customerPhone = stripWhatsAppPrefix(normalizedFrom);

    await saveMessage({
      user_id,
      bot_id: null,
      conversation_id,
      role: "user",
      content: message,
      channel: "whatsapp",
      phone_number: customerPhone,
      external_user_id: normalizedFrom,
      whatsapp_message_sid,
    });

    await upsertLead({
      user_id,
      conversation_id,
      phone: customerPhone,
      channel: "whatsapp",
    });

    const systemPrompt =
      config.default_prompt ||
      "You are a helpful WhatsApp assistant for this business. Keep replies short, clear, and friendly. Ask only the minimum needed follow-up questions.";

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            `Conversation ID: ${conversation_id}`,
            normalizedFrom ? `Customer Phone: ${normalizedFrom}` : null,
            `Message: ${message}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    const reply =
      chatResponse.choices[0]?.message?.content?.trim() ||
      "Sorry, I could not generate a reply right now.";

    await saveMessage({
      user_id,
      bot_id: null,
      conversation_id,
      role: "assistant",
      content: reply,
      channel: "whatsapp",
      phone_number: customerPhone,
      external_user_id: normalizedFrom,
      whatsapp_message_sid: null,
    });

    return NextResponse.json({
      reply,
      conversation_id,
      user_id,
      channel: "whatsapp",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
