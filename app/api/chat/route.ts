import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  try {

    const { message, botId, conversationId } = await req.json();

    // 1️⃣ Get knowledge base for this chatbot
    const { data: kb, error: kbError } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", botId)
      .limit(5);

    if (kbError) {
      console.error("Knowledge Base Error:", kbError);
    }

    // 2️⃣ Convert knowledge to text
    let knowledgeContext = "";

    if (kb && kb.length > 0) {
      knowledgeContext = kb
        .map((item: any) => {
          if (item.question && item.answer) {
            return `Q: ${item.question}\nA: ${item.answer}`;
          }
          return item.content || "";
        })
        .join("\n\n");
    }

    // 3️⃣ Send to OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {

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
You are an AI assistant for a business.

Use the company knowledge below to answer the user.

Company Knowledge:
${knowledgeContext}

If the answer is not in the knowledge base, answer normally.
`
          },

          {
            role: "user",
            content: message
          }

        ]
      })

    });

    const aiData = await aiResponse.json();

    const reply =
      aiData?.choices?.[0]?.message?.content ||
      "Sorry, I could not find the answer.";

    // 4️⃣ Save conversation
    if (conversationId) {

      await supabase.from("messages").insert([
        {
          conversation_id: conversationId,
          role: "user",
          content: message
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: reply
        }
      ]);

    }

    return NextResponse.json({ reply });

  } catch (error) {

    console.error("Chat API Error:", error);

    return NextResponse.json({
      reply: "Something went wrong."
    });

  }

}