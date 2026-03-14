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

  /* LOAD BOT */

  useEffect(() => {

    const init = async () => {

      if (!botId) {
        setLoading(false);
        return;
      }

      const { data: botData } = await supabase
        .from("chatbots")
        .select("*")
        .eq("id", botId)
        .single();

      if (!botData) {
        setLoading(false);
        return;
      }

      setBot(botData);

      let storedConversation =
        localStorage.getItem(`chat_conversation_${botId}`);

      if (!storedConversation) {

        const { data } = await supabase
          .from("conversations")
          .insert([
            {
              chatbot_id: botId,
              visitor_id: crypto.randomUUID()
            }
          ])
          .select()
          .single();

        storedConversation = data.id;

        localStorage.setItem(
          `chat_conversation_${botId}`,
          data.id
        );
      }

      setConversationId(storedConversation);

      setMessages([
        {
          role: "assistant",
          content:
            botData.welcome_message ||
            "Hello! How can I help you?"
        }
      ]);

      setLoading(false);

    };

    init();

  }, [botId]);

  /* AUTO SCROLL */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* CONVERT TEXT → LINKS */

  const renderMessage = (text: string) => {

    const urlRegex = /(https?:\/\/[^\s]+)/g;

    return text.split(urlRegex).map((part, index) => {

      if (urlRegex.test(part)) {

        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#60a5fa",
              textDecoration: "underline",
              wordBreak: "break-all"
            }}
          >
            {part}
          </a>
        );

      }

      return part;

    });

  };

  /* SEND MESSAGE */

  const sendMessage = async () => {

    if (!input.trim() || sending) return;

    const userMessage = input.trim();

    setSending(true);

    setMessages(prev => [
      ...prev,
      { role: "user", content: userMessage }
    ]);

    setInput("");

    let convId = conversationId;

    const res = await fetch(
      "https://ai-chatbot-saas-five.vercel.app/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_id: convId,
          bot_id: botId,
          category: bot?.category || "booking"
        })
      }
    );

    const data = await res.json();

    setMessages(prev => [
      ...prev,
      {
        role: "assistant",
        content:
          data.reply ||
          "Sorry, I couldn't respond."
      }
    ]);

    setSending(false);

  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading chatbot...</div>;
  }

  return (

    <div
      style={{
        width: "100%",
        height: "520px",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        fontFamily: "Arial"
      }}
    >

      <div
        style={{
          background: "#2563eb",
          color: "#fff",
          padding: "12px",
          fontWeight: 600
        }}
      >
        {bot.name || "AI Assistant"}
      </div>

      <div
        style={{
          flex: 1,
          padding: 12,
          overflowY: "auto",
          background: "#f3f4f6"
        }}
      >

        {messages.map((msg, index) => (

          <div
            key={index}
            style={{
              marginBottom: 10,
              textAlign:
                msg.role === "user"
                  ? "right"
                  : "left"
            }}
          >

            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 8,
                background:
                  msg.role === "user"
                    ? "#2563eb"
                    : "#111827",
                color: "#fff",
                maxWidth: "75%",
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
            >
              {renderMessage(msg.content)}
            </div>

          </div>

        ))}

        <div ref={bottomRef} />

      </div>

      <div
        style={{
          borderTop: "1px solid #e5e7eb",
          padding: 10
        }}
      >

        <div style={{ display: "flex" }}>

          <input
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            placeholder="Type your message..."
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ccc"
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
              borderRadius: 6
            }}
          >
            {sending ? "..." : "Send"}
          </button>

        </div>

      </div>

    </div>

  );

}