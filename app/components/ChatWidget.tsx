"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ChatWidgetProps {
  chatbotId?: string;
  isEmbed?: boolean;
  plan?: string;
}

type Message = {
  role: string;
  content: string;
};

const ALLOWED_PAYMENT_HOSTS = new Set([
  "ai-chatbot-saas-five.vercel.app",
  "www.sandbox.paypal.com",
  "sandbox.paypal.com",
  "www.paypal.com",
  "paypal.com",
  "secure.payu.in",
  "test.payu.in",
]);

function getSafePaymentLink(content: string): string | null {
  const hrefMatch = content.match(/href=['"]([^'"]+)['"]/i);
  const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = hrefMatch?.[1] || urlMatch?.[0];

  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);

    if (parsed.protocol !== "https:") return null;
    if (!ALLOWED_PAYMENT_HOSTS.has(parsed.hostname)) return null;

    return parsed.toString();
  } catch {
    return null;
  }
}

export default function ChatWidget({
  chatbotId,
  isEmbed = false,
  plan = "free",
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [botCategory, setBotCategory] = useState("Booking");
  const [open, setOpen] = useState(isEmbed ? true : false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const activeBotId =
    chatbotId || "9ff1f58c-d09d-4449-97cc-a5860b640e2c";

  useEffect(() => {
    const loadBot = async () => {
      try {
        const { data, error } = await supabase
          .from("chatbots")
          .select("welcome_message, category")
          .eq("id", activeBotId)
          .single();

        if (error) throw error;

        if (data?.category) setBotCategory(data.category);

        setMessages([
          {
            role: "assistant",
            content:
              data?.welcome_message || "Hello! How can I help you today?",
          },
        ]);
      } catch (err) {
        console.error("Load error:", err);
        setMessages([
          {
            role: "assistant",
            content: "Hello! How can I help you today?",
          },
        ]);
      }
    };

    loadBot();
  }, [activeBotId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const currentInput = userInput.trim();

    const payload = {
      message: currentInput,
      bot_id: activeBotId,
      conversation_id: "session_" + activeBotId,
      category: botCategory,
    };

    const newMessages = [...messages, { role: "user", content: currentInput }];

    setMessages(newMessages);
    setUserInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        "https://ai-chatbot-saas-five.vercel.app/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.reply || "Server Error");
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.reply || "I received your message but have no response.",
        },
      ]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Connection lost. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentOpen = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const chatPanel = (
    <div
      className={
        isEmbed
          ? "flex h-full min-h-[500px] w-full flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl"
          : "flex h-[65vh] max-h-[500px] w-[90vw] max-w-[350px] flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl mb-2"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-white">
        <span className="font-semibold text-sm md:text-base">
          AI Assistant
        </span>

        {!isEmbed && (
          <button onClick={() => setOpen(false)} className="text-lg leading-none">
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3"
      >
        {messages.map((m, i) => {
          const paymentLink = getSafePaymentLink(m.content);
          const displayText = paymentLink
            ? "Click below to complete your payment."
            : m.content;

          return (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-2 text-xs md:text-sm whitespace-pre-wrap break-words ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border bg-white text-gray-800 shadow-sm"
                }`}
              >
                <div>{displayText}</div>

                {paymentLink && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handlePaymentOpen(paymentLink)}
                      className="font-semibold text-blue-600 underline"
                    >
                      Pay Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="text-xs text-gray-400 animate-pulse">
            Assistant is typing...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-white p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 rounded-md border px-3 py-2 text-xs md:text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendMessage}
            className="rounded-md bg-blue-600 px-3 py-2 text-xs md:text-sm text-white"
          >
            Send
          </button>
        </div>

        {plan === "free" && (
          <div className="mt-1 text-center text-[10px] text-gray-400">
            Powered by{" "}
            <a
              href="https://ai-chatbot-saas-five.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-blue-600"
            >
              aiautomation
            </a>
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbed) {
    return <div className="w-full">{chatPanel}</div>;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 font-sans">
      {open && chatPanel}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl text-white shadow-lg transition hover:scale-105"
      >
        💬
      </button>
    </div>
  );
}