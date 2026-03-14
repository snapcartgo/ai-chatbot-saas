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

  /* 1. INITIALIZE BOT & CONVERSATION */
  useEffect(() => {
    const init = async () => {
      if (!botId) {
        setLoading(false);
        return;
      }

      try {
        const { data: botData, error: botError } = await supabase
          .from("chatbots")
          .select("*")
          .eq("id", botId)
          .single();

        if (botError || !botData) {
          console.error("Bot not found");
          setLoading(false);
          return;
        }

        setBot(botData);

        let storedConvId = localStorage.getItem(`chat_conversation_${botId}`);

        if (!storedConvId) {
          const { data, error } = await supabase
            .from("conversations")
            .insert([
              {
                chatbot_id: botId,
                visitor_id: crypto.randomUUID(),
              },
            ])
            .select()
            .single();

          if (data) {
            storedConvId = data.id;
            localStorage.setItem(`chat_conversation_${botId}`, data.id);
          }
        }

        setConversationId(storedConvId);
        setMessages([
          {
            role: "assistant",
            content: botData.welcome_message || "Hello! How can I help you?",
          },
        ]);
      } catch (err) {
        console.error("Init Error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [botId]);

  /* AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* 2. LEAD CAPTURE LOGIC (Updated for your Schema) */
  const captureLead = async (text: string) => {
    // Detects phone numbers or emails
    const phoneRegex = /(\+?\d{1,4}[\s-]?)?(\(?\d{3}\)?[\s-]?)?[\d\s-]{7,10}/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    
    const foundPhone = text.match(phoneRegex);
    const foundEmail = text.match(emailRegex);

    if ((foundPhone || foundEmail) && conversationId) {
      console.log("Lead info detected, updating Supabase...");
      
      const { error } = await supabase
        .from("leads") 
        .upsert({ 
          phone: foundPhone ? foundPhone[0] : null,
          email: foundEmail ? foundEmail[0] : null,
          chatbot_id: botId,
          conversation_id: conversationId,
          name: "Chat Visitor"
        }, { onConflict: 'conversation_id' }); // Prevents duplicate rows for same chat

      if (error) console.error("Lead Update Error:", error.message);
    }
  };

  /* 3. ORDER HANDLER */
  const handleBuyClick = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      // NOTE: Ensure your /api/create-order route uses table name "order" (singular)
      await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          conversation_id: conversationId,
          product_name: "Google Maps Scraper",
          price: 29,
        }),
      });
    } catch (err) {
      console.error("Order creation failed:", err);
    }
    window.open(url, "_blank");
  };

  /* 4. SEND MESSAGE */
  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setSending(true);

    // Run lead detection
    await captureLead(userMessage);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    try {
      const res = await fetch("https://ai-chatbot-saas-five.vercel.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: conversationId,
          bot_id: botId,
          category: bot?.category || "booking",
        }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Sorry, I couldn't respond.",
        },
      ]);
    } catch (err) {
      console.error("Chat Error:", err);
    } finally {
      setSending(false);
    }
  };

  /* RENDER HELPERS */
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