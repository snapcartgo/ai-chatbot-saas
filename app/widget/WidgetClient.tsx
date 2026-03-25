"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function WidgetClient() {
  const searchParams = useSearchParams();
  const botId = searchParams.get("botId") || "";

  const [bot, setBot] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      if (!botId) { setLoading(false); return; }

      try {
        const { data: botData } = await supabase
          .from("chatbots")
          .select("*")
          .eq("id", botId)
          .single();

        if (botData) setBot(botData);

        let storedId = localStorage.getItem(`chat_conv_${botId}`);

        if (!storedId) {
          const { data } = await supabase
            .from("conversations")
            .insert([
              { chatbot_id: botId, visitor_id: crypto.randomUUID() }
            ])
            .select()
            .single();

          if (data) {
            storedId = data.id;
            localStorage.setItem(`chat_conv_${botId}`, data.id);
          }
        }

        setConversationId(storedId);

        setMessages([
          {
            role: "assistant",
            content: botData?.welcome_message || "Hello!"
          }
        ]);

      } catch (err) {
        console.error("Init Error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [botId]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setSending(true);
    setInput("");

    setMessages(prev => [...prev, { role: "user", content: userMsg }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          conversation_id: conversationId,
          bot_id: botId
        })
      });

      const data = await res.json();

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.reply || "..." }
      ]);

    } catch (err) {
      console.error("Chat Error:", err);
    }

    setSending(false);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading chatbot...</div>;

  return (
    <div style={{ height: "500px", display: "flex", flexDirection: "column" }}>
      
      <div style={{ padding: 10, background: "#2563eb", color: "#fff" }}>
        {bot?.name || "AI Assistant"}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
            <div
              style={{
                display: "inline-block",
                background: msg.role === "user" ? "#2563eb" : "#111827",
                color: "#fff",
                padding: 8,
                borderRadius: 6,
                marginBottom: 8
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", padding: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}