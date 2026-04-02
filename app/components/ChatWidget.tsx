"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface ChatWidgetProps {
  chatbotId?: string;
  isEmbed?: boolean;
  plan?: string;
}

function stripHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function parseMessageContent(content: string) {
  const anchorRegex = /<a\s+[^>]*href=['"]([^'"]+)['"][^>]*>(.*?)<\/a>/gi;
  const links: { href: string; label: string }[] = [];

  let match;
  while ((match = anchorRegex.exec(content)) !== null) {
    const href = match[1];
    const label = stripHtml(match[2]) || "Open link";

    if (/^https?:\/\//i.test(href)) {
      links.push({ href, label });
    }
  }

  const text = stripHtml(content.replace(anchorRegex, ""));

  return { text, links };
}

export default function ChatWidget({
  chatbotId,
  isEmbed = false,
  plan = "free",
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
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
              data?.welcome_message ||
              "Hello! How can I help you today?",
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
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const currentInput = userInput;

    const payload = {
      message: currentInput,
      bot_id: activeBotId,
      conversation_id: "session_" + activeBotId,
      category: botCategory,
    };

    const newMessages = [
      ...messages,
      { role: "user", content: currentInput },
    ];

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
          content:
            data.reply ||
            "I received your message but have no response.",
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

  return (
    <div
      className={
        isEmbed
          ? "w-full h-screen font-sans"
          : "fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 font-sans"
      }
    >
      {open && (
        <div
          className={
            isEmbed
              ? "flex flex-col h-screen w-full bg-white"
              : "flex flex-col w-[90vw] max-w-[360px] h-[75vh] max-h-[520px] bg-white rounded-2xl shadow-2xl border overflow-hidden"
          }
        >
          <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
            <span className="font-semibold text-sm md:text-base">
              AI Assistant
            </span>

            {!isEmbed && (
              <button
                onClick={() => setOpen(false)}
                className="text-lg"
              >
                ✕
              </button>
            )}
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50"
          >
            {messages.map((m, i) => {
              const parsed = parseMessageContent(m.content);

              return (
                <div
                  key={i}
                  className={`flex ${
                    m.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] p-2 rounded-xl text-xs md:text-sm whitespace-pre-wrap break-words ${
                      m.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-800 border shadow-sm"
                    }`}
                  >
                    {parsed.text && <div>{parsed.text}</div>}

                    {parsed.links.map((link, index) => (
                      <div key={index} className="mt-2">
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-blue-600 underline"
                        >
                          {link.label}
                        </a>
                      </div>
                    ))}
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

          <div className="p-2 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) =>
                  setUserInput(e.target.value)
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSendMessage()
                }
                placeholder="Type your message..."
                className="flex-1 border rounded-md px-3 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />

              <button
                onClick={handleSendMessage}
                className="bg-blue-600 text-white px-3 py-2 rounded-md text-xs md:text-sm"
              >
                Send
              </button>
            </div>

            {plan === "free" && (
              <div className="text-[10px] text-gray-400 text-center mt-1">
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
      )}

      {!isEmbed && (
        <button
          onClick={() => setOpen(!open)}
          className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-105 transition"
        >
          💬
        </button>
      )}
    </div>
  );
}
