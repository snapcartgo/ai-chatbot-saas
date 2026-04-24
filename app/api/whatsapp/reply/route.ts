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
    const conversation_id = body.conversation_id || body.conversationId || crypto.randomUUID();

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
            from_phone ? `Customer Phone: ${normalizeWhatsAppNumber(from_phone)}` : null,
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

    return NextResponse.json({
      reply,
      conversation_id,
      user_id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
