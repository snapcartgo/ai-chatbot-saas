"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface ChatWidgetProps {
  chatbotId?: string;
  isEmbed?: boolean;
  plan?: string;
}

const ADMIN_BOT_ID = "42e0b1a2-25f3-47ac-907d-ca3911d041c0"; // 🔥 your admin bot

export default function ChatWidget({ 
  chatbotId, 
  isEmbed = false,
  plan = "free"
}: ChatWidgetProps) {

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [botCategory, setBotCategory] = useState("Booking");
  const [open, setOpen] = useState(true); 
  const scrollRef = useRef<HTMLDivElement>(null);

  // ✅ FIXED CORE LOGIC (MOST IMPORTANT)
  const activeBotId = isEmbed
    ? chatbotId // 🌐 Client website → MUST use client bot
    : chatbotId || ADMIN_BOT_ID; // 🧑‍💻 Dashboard → fallback to admin

  // 🚨 Safety check (prevents data leakage)
  if (!activeBotId) {
    console.error("❌ chatbotId missing!");
    return null;
  }

  useEffect(() => {
    const loadBot = async () => {
      try {
        console.log("🔥 LOADING BOT:", activeBotId);

        const { data, error } = await supabase
          .from("chatbots")
          .select("welcome_message, category")
          .eq("id", activeBotId)
          .single();

        if (error) throw error;

        if (data?.category) setBotCategory(data.category);

        setMessages([{
          role: "assistant",
          content: data?.welcome_message || "Hello! How can I help you today?"
        }]);

      } catch (err) {
        console.error("Load error:", err);
        setMessages([
          { role: "assistant", content: "Hello 👋 How can I help you today?" }
        ]);
      }
    };

    loadBot();
  }, [activeBotId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const currentInput = userInput;

    // ✅ FIXED conversation id (UNIQUE PER SESSION)
    const conversationId = `session_${activeBotId}_${Date.now()}`;

    console.log("🚀 SENDING BOT ID:", activeBotId);

    const payload = {
      message: currentInput,
      bot_id: activeBotId,
      conversation_id: conversationId,
      category: botCategory,
    };

    const newMessages = [...messages, { role: "user", content: currentInput }];
    setMessages(newMessages);
    setUserInput("");
    setIsLoading(true);

    try {
      const response = await fetch("https://ai-chatbot-saas-five.vercel.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.reply || "Server Error");
      }

      setMessages([
        ...newMessages,
        { role: "assistant", content: data.reply || "No response received." }
      ]);

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Connection lost. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={isEmbed ? "w-full h-full font-sans" : "fixed bottom-6 right-6 z-50 font-sans"}>
      
      {open && (
        <div className={isEmbed 
          ? "w-full h-full bg-white flex flex-col overflow-hidden" 
          : "w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3 border"
        }>
          
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-md">
            <span className="font-bold text-lg">AI Assistant</span>
            {!isEmbed && (
              <button onClick={() => setOpen(false)} className="text-xl">✖</button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-800 border shadow-sm"
                }`}>
                  <span dangerouslySetInnerHTML={{ __html: m.content }} />
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-xs text-gray-400 animate-pulse">
                Assistant is typing...
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white flex flex-col items-center">
            <div className="flex gap-2 w-full mb-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <button 
                onClick={handleSendMessage}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                Send
              </button>
            </div>

            {/* Branding */}
            {plan === "free" && (
              <div className="text-[10px] text-gray-400">
                Powered by{" "}
                <a 
                  href="https://ai-chatbot-saas-five.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                >
                  aiautomation by woodpetra
                </a>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Floating Button */}
      {!isEmbed && (
        <button
          onClick={() => setOpen(!open)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center text-2xl hover:scale-105 transition-transform"
        >
          💬
        </button>
      )}
    </div>
  );
}