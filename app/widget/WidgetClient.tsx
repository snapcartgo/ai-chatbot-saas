"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
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

  /* --------------------------------------------------- */
  /* LOAD BOT + CREATE CONVERSATION */
  /* --------------------------------------------------- */

  useEffect(() => {
    const loadBot = async () => {
      try {
        if (!botId) {
          setLoading(false);
          return;
        }

        /* GET BOT */
        const { data: botData, error } = await supabase
          .from("chatbots")
          .select("*")
          .eq("id", botId as string)
          .single();

        if (error || !botData) {
          console.error("Bot not found");
          setLoading(false);
          return;
        }

        setBot(botData);

        /* PERSIST SESSION */
        let storedConversation: string | null =
  localStorage.getItem(`chat_conversation_${botId}`);

if (!storedConversation) {
  const { data: newConversation } = await supabase
    .from("conversations")
    .insert({
      chatbot_id: botId,
      visitor_id: crypto.randomUUID(),
    })
    .select()
    .single();

  storedConversation = newConversation?.id || null;

  if (storedConversation) {
    localStorage.setItem(
      `chat_conversation_${botId}`,
      storedConversation
    );
  }
}

if (storedConversation) {
  setConversationId(storedConversation);
}
        /* WELCOME MESSAGE */
        setMessages([
          {
            role: "assistant",
            content: botData.welcome_message || "Hello! How can I help you?",
          },
        ]);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    loadBot();
  }, [botId]);

  /* --------------------------------------------------- */
  /* AUTO SCROLL */
  /* --------------------------------------------------- */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* --------------------------------------------------- */
  /* SEND MESSAGE */
  /* --------------------------------------------------- */

  const sendMessage = async () => {
    if (!conversationId || sending || !input.trim()) return;

    const userMessage = input.trim();

    setSending(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    setInput("");

    try {
      const res = await fetch("https://ai-chatbot-saas-five.vercel.app/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
        message: userMessage,
        conversation_id: conversationId,
        bot_id: botId,
        user_id: bot.user_id
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
      console.error("Chat error:", err);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    }

    setSending(false);
  };

  /* --------------------------------------------------- */
  /* UI STATES */
  /* --------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ padding: 20, fontFamily: "Arial" }}>
        Loading chatbot...
      </div>
    );
  }

  if (!bot) {
    return (
      <div style={{ padding: 20, fontFamily: "Arial" }}>
        Chatbot not found
      </div>
    );
  }

  /* --------------------------------------------------- */
  /* UI */
  /* --------------------------------------------------- */

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
      {/* HEADER */}
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
        {bot.name || "AI Assistant"}
      </div>

      {/* CHAT AREA */}
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
                fontSize: "14px",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          background: "#ffffff",
          padding: "10px",
        }}
      >
        <div style={{ display: "flex" }}>
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
            disabled={sending}
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

        {/* POWERED BY */}
        <div
          style={{
            textAlign: "center",
            fontSize: "12px",
            marginTop: "6px",
            color: "#6b7280",
          }}
        >
          Powered by{" "}
          <a
            href="https://woodpetra.com"
            target="_blank"
            style={{ color: "#2563eb", textDecoration: "none" }}
          >
            Wood Petra
          </a>
        </div>
      </div>
    </div>
  );
}