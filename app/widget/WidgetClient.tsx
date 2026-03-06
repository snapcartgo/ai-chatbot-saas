"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBot = async () => {
      if (!botId) return;

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

      const { data: newConversation } = await supabase
        .from("conversations")
        .insert({
          chatbot_id: botId,
          visitor_id: crypto.randomUUID(),
        })
        .select()
        .single();

      if (newConversation?.id) {
        setConversationId(newConversation.id);
      }

      setMessages([
        {
          role: "assistant",
          content: botData.welcome_message,
          created_at: new Date().toISOString(),
        },
      ]);

      setLoading(false);
    };

    loadBot();
  }, [botId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!conversationId || sending || !input.trim()) return;

    setSending(true);
    const userMessage = input;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
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
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error(err);
    }

    setSending(false);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!bot) return <div style={{ padding: 20 }}>Bot not found</div>;

  return (
    <div
      style={{
        width: "100%",
        height: "520px",
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        fontFamily: "Arial, sans-serif",
        borderRadius: "12px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#2563eb",
          color: "#fff",
          padding: "12px",
          fontWeight: 600,
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
        }}
      >
        {bot.name}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: 12,
          overflowY: "auto",
          background: "#f3f4f6",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              marginBottom: 10,
              textAlign: msg.role === "user" ? "right" : "left",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 8,
                background: msg.role === "user" ? "#2563eb" : "#111827",
                color: "#fff",
                maxWidth: "75%",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: "flex",
          padding: 10,
          borderTop: "1px solid #e5e7eb",
          background: "#ffffff",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            color: "#000",
            fontSize: "14px",
            outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
        />

        <button
          onClick={sendMessage}
          style={{
            marginLeft: 8,
            padding: "8px 14px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}