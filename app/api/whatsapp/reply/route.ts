import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role to bypass RLS for automation
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper: Standardize numbers
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

// 1. Fixed: Ensuring a valid UUID for every conversation
async function ensureConversationRow(params: {
  user_id: string;
  chatbot_id: string | null;
  phone: string;
  visitor_id: string;
}) {
  // Check if a conversation already exists for this phone number and user
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", params.user_id)
    .eq("phone", params.phone)
    .maybeSingle();

  if (findError) console.error("Lookup error:", findError);
  if (existing?.id) return existing.id;

  // Create a new one if it doesn't exist
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: params.user_id,
      chatbot_id: params.chatbot_id,
      visitor_id: params.visitor_id,
      name: `WhatsApp: ${params.phone}`,
      phone: params.phone,
      channel: "whatsapp",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Insert error:", error);
    return crypto.randomUUID(); // Fallback to a random UUID if DB fails
  }

  return data?.id;
}

async function saveMessage(data: any) {
  const { error } = await supabase.from("messages").insert(data);
  if (error) console.error("Message save error:", error);
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

    // ✅ NEW: Accept knowledge from n8n
    const knowledge = body.knowledge || body.kb || "";

    const whatsapp_message_sid = body.whatsapp_message_sid || body.messageSid || null;

    if (!message || !user_id) {
      return NextResponse.json({ error: "Missing user_id or message" }, { status: 400 });
    }

    // Get Bot Config
    const { data: config } = await supabase
      .from("whatsapp_configs")
      .select("chatbot_id, default_prompt")
      .eq("user_id", user_id)
      .single();

    const normalizedFrom = normalizeWhatsAppNumber(from_phone);
    const customerPhone = stripWhatsAppPrefix(normalizedFrom);

    const conversation_id = await ensureConversationRow({
      user_id,
      chatbot_id: config?.chatbot_id || null,
      phone: customerPhone,
      visitor_id: normalizedFrom,
    });

    // Save User Message
    await saveMessage({
      user_id,
      bot_id: config?.chatbot_id,
      conversation_id,
      role: "user",
      content: message,
      channel: "whatsapp",
      phone_number: customerPhone,
      external_user_id: normalizedFrom,
      whatsapp_message_sid,
    });

    // Fetch history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(6);

    const historyMessages = (history || [])
      .reverse()
      .map(m => ({ role: m.role, content: m.content }));

    // ✅ IMPORTANT: Inject Knowledge into system prompt
    const systemPrompt = `
      You are a smart AI sales assistant.

      STRICT RULES:
      - You MUST answer using ONLY the knowledge provided below
      - Do NOT say "I don't know" if answer exists in knowledge
      - Extract exact details like price, product name, features
      - Be direct and helpful

      KNOWLEDGE BASE:
      ${knowledge}

      USER QUESTION:
      ${message}

      Give a clear and direct answer.
      `;

    // AI Response
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: message },
      ],
    });

    const reply =
      chatResponse.choices[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    // Save bot response
    await saveMessage({
      user_id,
      bot_id: config?.chatbot_id,
      conversation_id,
      role: "assistant",
      content: reply,
      channel: "whatsapp",
      phone_number: customerPhone,
      external_user_id: normalizedFrom,
    });

    return NextResponse.json({ reply, conversation_id });

  } catch (error: any) {
    console.error("API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}