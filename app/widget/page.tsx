"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ✅ FIXED: Define the Message type (Solves error in image_0168d0.png)
type Message = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export default function WidgetPage() {
  const searchParams = useSearchParams();
  const botId = searchParams.get("botId");

  const [bot, setBot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  
  // ✅ FIXED: State for the conversation ID (Solves error in image_0156a6.png)
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBot = async () => {
      if (!botId) return;

      // 1. Fetch bot details
      const { data: botData } = await supabase
        .from("chatbots")
        .select("*")
        .eq("id", botId)
        .maybeSingle();

      if (!botData) {
        setLoading(false);
        return;
      }
      setBot(botData);

      // 2. Create NEW conversation row
      // ✅ FIXED: Passing botId correctly without DB conflict
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          chatbot_id: botId,
          visitor_id: crypto.randomUUID(),
        })
        .select()
        .single();

      if (convError) {
        console.error("Conversation insert failed:", convError.message, convError);
      }

      if (newConversation?.id) {
        setConversationId(newConversation.id);
      }

      // 3. Initial welcome message
      setMessages([{
        role: "assistant",
        content: botData.welcome_message,
        created_at: new Date().toISOString(),
      }]);

      setLoading(false);
    };

    loadBot();
  }, [botId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    // ✅ FIXED: Log error if conversationId is missing (Fixes issue in image_0156a6.png)
    if (!conversationId) {
      console.error("Cannot send message: No active conversation ID found.");
      return;
    }

    if (sending || !input.trim()) return;

    setSending(true);
    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, created_at: new Date().toISOString() },
    ]);

    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          botId,
          conversationId, 
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      console.error("Chat Error:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!bot) return <div style={{ padding: 20 }}>Bot not found</div>;

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "#ffffff", fontFamily: "Arial" }}>
      <div style={{ background: "#2563eb", color: "#fff", padding: "12px", fontWeight: 600 }}>
        {bot.name}
      </div>

      <div style={{ flex: 1, padding: 12, overflowY: "auto", background: "#f3f4f6" }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: 10, textAlign: msg.role === "user" ? "right" : "left" }}>
            <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 8, background: msg.role === "user" ? "#2563eb" : "#111827", color: "#fff", maxWidth: "80%" }}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", padding: 10, borderTop: "1px solid #d8e3fa" }}>
        <input
  value={input}
  onChange={(e) => setInput(e.target.value)}
  placeholder="Type your message..."
  style={{
    flex: 1,
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    backgroundColor: "#ffffff", // Pure white background
    color: "#000000",           // Force black text color
    fontSize: "16px",           // Prevents auto-zoom on mobile
    outline: "none",
  }}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  }}
/>
        <button onClick={sendMessage} style={{ marginLeft: 8, padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}