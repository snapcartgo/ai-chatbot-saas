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

  // 1. Initialize Bot & Conversation
  useEffect(() => {
    const init = async () => {
      if (!botId) { setLoading(false); return; }

      try {
        const { data: botData } = await supabase.from("chatbots").select("*").eq("id", botId).single();
        if (botData) setBot(botData);

        let storedId = localStorage.getItem(`chat_conv_${botId}`);
        if (!storedId) {
          const { data } = await supabase.from("conversations")
            .insert([{ chatbot_id: botId, visitor_id: crypto.randomUUID() }])
            .select().single();
          if (data) {
            storedId = data.id;
            localStorage.setItem(`chat_conv_${botId}`, data.id);
          }
        }
        setConversationId(storedId);
        setMessages([{ role: "assistant", content: botData?.welcome_message || "Hello!" }]);
      } catch (err) {
        console.error("Init Error:", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [botId]);

  // 2. Lead Capture (Requires "Unique" constraint on conversation_id in Supabase)
  const captureLead = async (text: string) => {
    const phoneRegex = /(\+?\d{1,4}[\s-]?)?(\(?\d{3}\)?[\s-]?)?[\d\s-]{7,10}/g;
    const foundPhone = text.match(phoneRegex);

    if (foundPhone && conversationId) {
      const { error } = await supabase
        .from("leads")
        .upsert({ 
          phone: foundPhone[0],
          chatbot_id: botId,
          conversation_id: conversationId,
          name: "Chat Lead"
        }, { onConflict: 'conversation_id' });

      if (error) console.error("Lead Save Error:", error.message);
    }
  };

  // 3. Order Handler (Ensure your API uses table "order" singular)
  const handleBuyClick = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          conversation_id: conversationId,
          product_name: "Google Maps Scraper",
          price: 29,
          lead_id: conversationId // Renamed from 'laed_id'
        }),
      });
    } catch (err) { console.error("Order failed:", err); }
    window.open(url, "_blank");
  };

  // 4. Send Message
  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setSending(true);
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);

    await captureLead(userMsg);

    try {
      const res = await fetch("https://ai-chatbot-saas-five.vercel.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          conversation_id: conversationId,
          bot_id: botId,
          category: bot?.category || "booking"
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "..." }]);
    } catch (err) { console.error("Chat Error:", err); }
    setSending(false);
  };

  /* ... Render Helpers (renderMessage, etc) and JSX Return ... */
    const renderMessage = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const cleanUrl = part.replace(/[()\[\]]/g, "");
        return (
          <span
            key={index}
            onClick={(e) => handleBuyClick(e, cleanUrl)}
            style={{ color: "#60a5fa", textDecoration: "underline", cursor: "pointer" }}
          >
            {cleanUrl}
          </span>
        );
      }
      return part;
    });
  };

  if (loading) return <div style={{ padding: 20 }}>Loading chatbot...</div>;

  return (
    <div style={{ width: "100%", height: "520px", display: "flex", flexDirection: "column", background: "#fff", fontFamily: "Arial" }}>
      <div style={{ background: "#2563eb", color: "#fff", padding: "12px", fontWeight: 600 }}>
        {bot?.name || "AI Assistant"}
      </div>

      <div style={{ flex: 1, padding: 12, overflowY: "auto", background: "#f3f4f6" }}>
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: 10, textAlign: msg.role === "user" ? "right" : "left" }}>
            <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 8, background: msg.role === "user" ? "#2563eb" : "#111827", color: "#fff", maxWidth: "75%" }}>
              {renderMessage(msg.content)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "1px solid #e5e7eb", padding: 10 }}>
        <div style={{ display: "flex" }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={sending}
            style={{ marginLeft: 8, padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6 }}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}