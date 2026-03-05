import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {

    const { message, botId, conversationId } = await req.json();

    if (!message) {
      return NextResponse.json({ reply: "No message received." });
    }

    // 🔹 Get chatbot info
    const { data: bot } = await supabase
      .from("chatbots")
      .select("*")
      .eq("id", botId)
      .single();

    const userId = bot?.user_id;

    // 🔹 Save user message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      chatbot_id: botId
    });

    // 🔥 Send message to n8n workflow
    const workflow = await fetch("https://n8n.snapcartgo.com/webhook/CreateAppointmentbooking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: message,
        chatbot_id: botId,
        conversation_id: conversationId,
        user_id: userId
      })
    });

    const workflowResponse = await workflow.json();

    const reply = workflowResponse.reply || "Okay.";

    // 🔹 Save assistant message
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: reply,
      chatbot_id: botId
    });

    return NextResponse.json({ reply });

  } catch (error) {

    console.error("Chat error:", error);

    return NextResponse.json({
      reply: "Something went wrong."
    });

  }
}