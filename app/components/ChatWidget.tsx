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

function processMessageContent(content: string) {
  const urlMatch = content.match(/https?:\/\/[^\s]+/g);

  return {
    urls: urlMatch || [],
    cleanText: content
  };
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
  const activeBotId = chatbotId || "9ff1f58c-d09d-4449-97cc-a5860b640e2c";

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
            content: data?.welcome_message || "Hello! How can I help you today?",
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

  // 1. Check if this browser already has a unique session ID
  let uniqueSessionId = localStorage.getItem(`chat_session_${activeBotId}`);

  // 2. If not, create a new one (Unique per person)
  // 2. If not, create a new one (Unique per person)
if (!uniqueSessionId) {
    // Generate a cryptographically secure random string
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const secureRandom = array[0].toString(36);
    
    uniqueSessionId = "session_" + secureRandom + "_" + Date.now();
    localStorage.setItem(`chat_session_${activeBotId}`, uniqueSessionId);
}

  const currentInput = userInput.trim();
  const payload = {
    message: currentInput,
    bot_id: activeBotId,
    conversation_id: uniqueSessionId, // <--- Now it uses the UNIQUE ID
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
      if (!response.ok) throw new Error(data.reply || "Server Error");

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
          content: "I'm having trouble connecting right now. Could you try that again in a moment.",
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
      className={`flex flex-col overflow-hidden border bg-white shadow-2xl transition-all duration-300 
      ${isEmbed ? "h-full w-full rounded-2xl" : "h-[450px] w-[92vw] sm:w-[350px] rounded-2xl"}`}
      style={isEmbed ? { height: '100dvh' } : {}}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between bg-blue-600 px-4 py-3 text-white">
        <span className="text-sm font-semibold md:text-base">AI Assistant</span>
        {!isEmbed && (
          <button onClick={() => setOpen(false)} className="text-lg leading-none hover:opacity-80">✕</button>
        )}
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3 overscroll-contain"
      >
        {messages.map((m, i) => {
          const { urls, cleanText } = processMessageContent(m.content);

return (
  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
    <div className={`max-w-[85%] rounded-xl p-2 text-xs md:text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "bg-blue-600 text-white" : "border bg-white text-gray-800 shadow-sm"}`}>
      
      {/* TEXT + CLICKABLE LINKS */}
      <div>
        {cleanText.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
          part.match(/https?:\/\/[^\s]+/) ? (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              {part}
            </a>
          ) : (
            part
          )
        )}
      </div>

      {/* BUTTON */}
      {urls.length > 0 && (
        <button
          onClick={() => window.open(urls[0], "_blank")}
          className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-white"
        >
          Open Link
        </button>
      )}

    </div>
  </div>
);
        })}
        {isLoading && <div className="text-xs text-gray-400 animate-pulse">Assistant is typing...</div>}
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t bg-white p-2">
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
            className="rounded-md bg-blue-600 px-3 py-2 text-xs md:text-sm text-white hover:bg-blue-700 transition"
          >
            Send
          </button>
        </div>
        {plan === "free" && (
          <div className="mt-1 text-center text-[10px] text-gray-400">
            Powered by <a href="https://ai-chatbot-saas-five.vercel.app" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-blue-600">aiautomation</a>
          </div>
        )}
      </div>
    </div>
  );

  // When embedded in an iframe, we return just the panel with a wrapper that allows for no-bg gaps
  if (isEmbed) {
    return (
      <div className="fixed inset-0 flex h-full w-full items-end justify-end bg-transparent p-0">
        {chatPanel}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-sans">
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
