import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  const { message, botId, conversationId } = await req.json();

  // 1️⃣ Search Knowledge Base
  const { data: kb } = await supabase
    .from("knowledge_base")
    .select("*")
    .eq("chatbot_id", botId)
    .ilike("content", `%${message}%`)
    .limit(3);

  let knowledgeContext = "";

  if (kb && kb.length > 0) {
    knowledgeContext = kb
      .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");
  }

  // 2️⃣ Call AI
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an AI assistant.

Use this company knowledge to answer the user:

${knowledgeContext}

If the answer is not in the knowledge base, answer normally.
          `,
        },
        {
          role: "user",
          content: message,
        },
      ],
    }),
  });

  const data = await response.json();

  const reply = data.choices[0].message.content;

  return NextResponse.json({ reply });

}