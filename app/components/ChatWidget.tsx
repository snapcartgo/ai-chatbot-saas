"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ADD THIS TYPE DEFINITION
interface ChatWidgetProps {
  chatbotId?: string;
  isEmbed?: boolean; // New prop to handle the "fullscreen" embed mode
}

export default function ChatWidget({ chatbotId, isEmbed = false }: ChatWidgetProps) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // If it's an embed, we want it open by default
  const [open, setOpen] = useState(isEmbed); 

  // Use the prop chatbotId, or fall back to your test ID if none provided
  const activeBotId = chatbotId || "f7b1a0c1-f55f-4bbc-8a27-d08b6076c3ea";
  const sessionId = "session_test_new";

  // LOAD WELCOME MESSAGE
  useEffect(() => {
    const loadBot = async () => {
      const { data } = await supabase
        .from("chatbots")
        .select("welcome_message")
        .eq("id", activeBotId) // USE DYNAMIC ID
        .single();

      if (data?.welcome_message) {
        setMessages([{ role: "assistant", content: data.welcome_message }]);
      } else {
        setMessages([{ role: "assistant", content: "Hello 👋 How can I help you today?" }]);
      }
    };
    loadBot();
  }, [activeBotId]);

  // ... rest of your handleSendMessage logic (ensure you use activeBotId there too!)

  return (
    // If isEmbed is true, we remove fixed positioning and the floating button
    <div className={isEmbed ? "w-full h-full font-sans" : "fixed bottom-6 right-6 z-50 font-sans"}>
      
      {/* CHAT WINDOW */}
      {open && (
        <div className={isEmbed 
          ? "w-full h-full bg-white flex flex-col overflow-hidden" 
          : "w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3 border"
        }>
          {/* HEADER (Keep your existing header code here) */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
             {/* ... header content ... */}
             {!isEmbed && <button onClick={() => setOpen(false)}>✖</button>}
          </div>

          {/* MESSAGES & INPUT (Keep your existing code here) */}
          {/* ... */}
        </div>
      )}

      {/* Only show floating button if NOT in embed mode */}
      {!isEmbed && (
        <button
          onClick={() => setOpen(!open)}
          className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center text-xl"
        >
          💬
        </button>
      )}
    </div>
  );
}