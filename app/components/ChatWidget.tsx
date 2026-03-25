"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface ChatWidgetProps {
  chatbotId?: string;
  isEmbed?: boolean;
}

export default function ChatWidget({ chatbotId, isEmbed = false }: ChatWidgetProps) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Force open to true so the embed page isn't blank
  const [open, setOpen] = useState(true); 
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeBotId = chatbotId || "f7b1a0c1-f55f-4bbc-8a27-d08b6076c3ea";

  // 1. SAFE DATA LOADING
  useEffect(() => {
    const loadBot = async () => {
      try {
        const { data, error } = await supabase
          .from("chatbots")
          .select("welcome_message")
          .eq("id", activeBotId)
          .single();

        if (error) throw error;

        setMessages([{ 
          role: "assistant", 
          content: data?.welcome_message || "Hello! How can I help you today?" 
        }]);
      } catch (err) {
        console.error("Load error:", err);
        // Fallback so the screen isn't blank if Supabase fails
        setMessages([{ role: "assistant", content: "Hello 👋 How can I help you today?" }]);
      }
    };
    loadBot();
  }, [activeBotId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const newMessages = [...messages, { role: "user", content: userInput }];
    setMessages(newMessages);
    setUserInput("");
    setIsLoading(true);

    try {
      // Replace this URL with your actual AI API endpoint
     const response = await fetch("https://ai-chatbot-saas-five.vercel.app/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    message: userInput, 
    chatbotId: activeBotId, // Ensure this matches what your API expects
    type: "text" 
  }),
});
      const data = await response.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages([...newMessages, { role: "assistant", content: "Sorry, I'm having trouble connecting." }]);
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
          {/* HEADER */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between shadow-md">
            <span className="font-bold text-lg">AI Assistant</span>
            {!isEmbed && <button onClick={() => setOpen(false)} className="text-xl">✖</button>}
          </div>

          {/* MESSAGES AREA - THIS WAS MISSING */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  m.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border shadow-sm"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && <div className="text-xs text-gray-400 animate-pulse">Assistant is typing...</div>}
          </div>

          {/* INPUT AREA */}
          <div className="p-4 border-t bg-white flex gap-2">
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
        </div>
      )}

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