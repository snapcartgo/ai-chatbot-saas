import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {

  const { message, botId, conversationId } = await req.json();

  // 1️⃣ Get knowledge base content
  const { data: kb } = await supabase
    .from("knowledge_base")
    .select("question,answer,content")
    .eq("chatbot_id", botId)
    .limit(5);

  let knowledgeText = "";

  if (kb && kb.length > 0) {

    knowledgeText = kb
      .map((k: any) => {
        if (k.question && k.answer) {
          return `Q: ${k.question}\nA: ${k.answer}`;
        }
        return k.content;
      })
      .join("\n\n");

  }

  // 2️⃣ Build AI prompt
  const prompt = `
You are an AI assistant for a business.

Use the company knowledge below to answer the user.

Company Knowledge:
${knowledgeText}

User Question:
${message}
`;

  // 3️⃣ Call AI (OpenAI example)
  const ai = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful AI assistant." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const result = await ai.json();

  const reply = result.choices?.[0]?.message?.content || "Sorry, I couldn't answer that.";

  // 4️⃣ Save conversation
  await supabase.from("messages").insert([
    {
      conversation_id: conversationId,
      role: "user",
      content: message,
    },
    {
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
    },
  ]);

  return NextResponse.json({ reply });

}