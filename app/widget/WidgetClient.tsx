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