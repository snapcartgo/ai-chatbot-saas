import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, botId, conversationId } = await req.json();

    if (!message || !botId) {
      return NextResponse.json({
        reply: "Invalid request."
      });
    }

    /* ------------------------------------------------ */
    /* 1️⃣ GET KNOWLEDGE BASE */
    /* ------------------------------------------------ */

    const { data: kb } = await supabase
      .from("knowledge_base")
      .select("*")
      .eq("chatbot_id", botId)
      .limit(5);

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

    /* ------------------------------------------------ */
    /* 2️⃣ CALL N8N WORKFLOW */
    /* ------------------------------------------------ */

    let workflowReply: string | null = null;

    try {
      const webhookResponse = await fetch(
        process.env.NEXT_PUBLIC_N8N_WEBHOOK!,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            botId,
            conversationId,
            knowledge: knowledgeContext
          }),
        }
      );

      const workflowData = await webhookResponse.json();

      if (workflowData?.reply) {
        workflowReply = workflowData.reply;
      }
    } catch (err) {
      console.error("Webhook error:", err);
    }

    /* ------------------------------------------------ */
    /* 3️⃣ FALLBACK TO OPENAI IF WORKFLOW DOESN'T REPLY */
    /* ------------------------------------------------ */

    let reply = workflowReply;

    if (!reply) {
      const aiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
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
`,
              },
              {
                role: "user",
                content: message,
              },
            ],
          }),
        }
      );

      const aiData = await aiResponse.json();

      reply =
        aiData?.choices?.[0]?.message?.content ||
        "Sorry, I could not find the answer.";
    }

    /* ------------------------------------------------ */
    /* 4️⃣ SAVE CONVERSATION */
    /* ------------------------------------------------ */

    if (conversationId) {
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
    }

    /* ------------------------------------------------ */
    /* 5️⃣ RETURN RESPONSE */
    /* ------------------------------------------------ */

    return NextResponse.json({ reply });

  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json({
      reply: "Something went wrong.",
    });
  }
}