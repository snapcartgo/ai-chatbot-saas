"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

interface ChatWidgetProps {
  chatbotId?: string;
  isEmbed?: boolean;
  plan?: string;
  niche?: string; 
}

type Message = {
  role: "user" | "assistant";
  content: string;
  actionUrl?: string;
  actionLabel?: string;
};

// --- CONFIGURATION ---

const PROMPTS: Record<string, string> = {
  // FIX: Added eCommerce prompt to stop the AI from thinking it's a SaaS bot
  ecommerce: "You are a Retail Assistant for an eCommerce store. You only sell physical products like T-shirts. If you see a price of ₹2, it is a promotional product price. DO NOT mention SaaS billing, plans, or subscriptions.",
  dentist: "You are a professional dental assistant for SmileCare. Your goal is to triage dental pain and book cleanings. Be clinical, clean, and reassuring.",
  salon: "You are a beauty concierge for Luxe & Gloss. Help clients choose between styling services or simple trims. Use friendly, upbeat language.",
  'real-estate': "You are a high-end property consultant. Focus on qualifying leads by asking for their budget and locations before booking a viewing.",
  general: "You are a helpful AI assistant. Answer questions clearly and professionally."
};

const EXTERNAL_PAYMENT_HOSTS = new Set([
  "www.sandbox.paypal.com",
  "sandbox.paypal.com",
  "www.paypal.com",
  "paypal.com",
  "secure.payu.in",
  "test.payu.in",
]);

const PLAIN_URL_REGEX = /\bhttps?:\/\/[^\s<>"']+/gi;

// --- UTILS ---

function sanitizeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function processMessageContent(content: string) {
  const firstUrl = content.match(PLAIN_URL_REGEX)?.[0] ?? null;
  let safeUrl: string | null = null;
  let cleanText = content;

  if (firstUrl) {
    const normalized = sanitizeHttpUrl(firstUrl);
    if (normalized) {
      const parsed = new URL(normalized);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();

      const isExternalGateway = EXTERNAL_PAYMENT_HOSTS.has(host);
      const isInternalPaymentPath =
        host === "ai-chatbot-saas-five.vercel.app" &&
        (path.includes("payment") ||
          path.includes("checkout") ||
          path.includes("payu") ||
          path.includes("paypal") ||
          path.includes("order-success"));

      if (isExternalGateway || isInternalPaymentPath) {
        safeUrl = normalized;
        cleanText = "Payment link generated.";
      }
    }
  }

  return { safeUrl, cleanText };
}

function renderTextWithLinks(text: string) {
  const parts = text.split(PLAIN_URL_REGEX);
  const matches = text.match(PLAIN_URL_REGEX) ?? [];
  const nodes: ReactNode[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i]) nodes.push(<span key={`t-${i}`}>{parts[i]}</span>);
    if (i < matches.length) {
      const safeHref = sanitizeHttpUrl(matches[i]);
      if (safeHref) {
        nodes.push(
          <a
            key={`u-${i}`}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600 hover:text-blue-700 break-all"
          >
            {safeHref}
          </a>
        );
      } else {
        nodes.push(<span key={`x-${i}`}>{matches[i]}</span>);
      }
    }
  }
  return nodes;
}

export default function ChatWidget({
  chatbotId,
  isEmbed = false,
  plan = "free",
  niche = "general",
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [botCategory, setBotCategory] = useState("booking");
  const [open, setOpen] = useState(isEmbed);

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
        setMessages([{ role: "assistant", content: "Hello! How can I help you today?" }]);
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
    if (isLoading || !userInput.trim()) return;

    let uniqueSessionId = localStorage.getItem(`chat_session_${activeBotId}`);
    if (!uniqueSessionId) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const secureRandom = array[0].toString(36);
      uniqueSessionId = `session_${secureRandom}_${Date.now()}`;
      localStorage.setItem(`chat_session_${activeBotId}`, uniqueSessionId);
    }

    const currentInput = userInput.trim();
    
    const payload = {
      message: currentInput,
      bot_id: activeBotId,
      conversation_id: uniqueSessionId,
      category: botCategory,
      niche: niche,
      system_instructions: PROMPTS[niche] || PROMPTS.general, 
    };

    const newMessages: Message[] = [...messages, { role: "user", content: currentInput }];
    setMessages(newMessages);
    setUserInput("");
    setIsLoading(true);

    try {
      const response = await fetch("https://ai-chatbot-saas-five.vercel.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 429) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "⚠️ Too many messages. Please wait a few seconds before trying again.",
          },
        ]);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid server response");
      }

      if (!response.ok) {
        throw new Error(data?.reply || "Server Error");
      }

      const safeActionUrl =
        typeof data.redirect_url === "string"
          ? sanitizeHttpUrl(data.redirect_url)
          : null;

      // FIX: Improved Logic for the Button Label
      let actionLabel: string | undefined;
      if (safeActionUrl) {
        const lower = safeActionUrl.toLowerCase();
        
        // If the niche is eCommerce, ALWAYS show Buy Now
        if (niche === "ecommerce") {
          actionLabel = "Buy Now";
        } 
        // Only show Open Billing for the SaaS/Admin niche
        else if (niche === "saas" || lower.includes("/dashboard/billing")) {
          actionLabel = "Open Billing";
        }
        else if (lower.includes("/contact")) {
          actionLabel = "Open Contact Us";
        }
        else {
          actionLabel = "Open Page";
        }
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.reply || "I received your message but have no response.",
          actionUrl: safeActionUrl || undefined,
          actionLabel,
        },
      ]);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "I am having trouble connecting right now. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = (url: string) => {
    const safe = sanitizeHttpUrl(url);
    if (!safe) return;
    window.open(safe, "_blank", "noopener,noreferrer");
  };

  const chatPanel = (
    <div
      className={`flex flex-col overflow-hidden border bg-white shadow-2xl transition-all duration-300 ${
        isEmbed ? "h-full w-full rounded-2xl" : "h-[450px] w-[92vw] sm:w-[350px] rounded-2xl"
      }`}
      style={isEmbed ? { height: "100%" } : {}}
    >
      <div className="flex shrink-0 items-center justify-between bg-blue-600 px-4 py-3 text-white">
        <span className="text-sm font-semibold md:text-base">AI Assistant</span>
        {!isEmbed && (
          <button
            onClick={() => setOpen(false)}
            className="text-lg leading-none hover:opacity-80"
            aria-label="Close chat"
          >
            ×
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3 overscroll-contain">
        {messages.map((m, i) => {
          const { safeUrl, cleanText } = processMessageContent(m.content);
          const actionUrl = m.actionUrl || safeUrl;
          // FIX: Default to "Buy Now" for eCommerce here too
          const actionLabel = m.actionLabel || (niche === "ecommerce" ? "Buy Now" : "Open Page");

          return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl p-2 text-xs shadow-sm md:text-sm ${
                  m.role === "user" ? "bg-blue-600 text-white" : "border bg-white text-gray-800"
                }`}
              >
                <div>
                  {safeUrl ? "Click below to complete your order:" : renderTextWithLinks(cleanText)}
                </div>

                {actionUrl && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => handleOpen(actionUrl)}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-center font-bold text-white transition hover:bg-blue-700"
                    >
                      {actionLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && <div className="animate-pulse text-xs text-gray-400">Assistant is typing...</div>}
      </div>

      <div className="shrink-0 border-t bg-white p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 rounded-md border px-3 py-2 text-xs text-black focus:outline-none focus:ring-2 focus:ring-blue-500 md:text-sm"
          />
          <button
            onClick={handleSendMessage}
            className="rounded-md bg-blue-600 px-3 py-2 text-xs text-white transition hover:bg-blue-700 md:text-sm"
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
    return <div className="h-full w-full">{chatPanel}</div>;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-sans">
      {open && chatPanel}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl text-white shadow-lg transition hover:scale-105"
        aria-label="Toggle chat"
      >
        💬
      </button>
    </div>
  );
}