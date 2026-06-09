"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type ReactNode,
} from "react";
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
  imagePreviewUrl?: string;
  imageName?: string;
  messageType?: "text" | "product";
  productName?: string;
  productDescription?: string;
  productPrice?: number | string;
  productImageUrl?: string;
  productCategory?: string;
  productUrl?: string;
};

type EnterpriseImageAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};

type SpeechRecognitionAlternativeLite = {
  transcript: string;
};

type SpeechRecognitionResultLite = {
  0: SpeechRecognitionAlternativeLite;
  length: number;
  isFinal?: boolean;
};

type SpeechRecognitionResultListLite = {
  [index: number]: SpeechRecognitionResultLite;
  length: number;
};

type SpeechRecognitionEventLite = {
  results: SpeechRecognitionResultListLite;
  resultIndex?: number;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLite) => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

const PROMPTS: Record<string, string> = {
  ecommerce:
    "You are a Retail Assistant for an eCommerce store. You only sell physical products like T-shirts. If you see a price of Rs.2, it is a promotional product price. DO NOT mention SaaS billing, plans, or subscriptions.",
  dentist:
    "You are a professional dental assistant for SmileCare. Your goal is to triage dental pain and book cleanings. Be clinical, clean, and reassuring.",
  salon:
    "You are a beauty concierge for Luxe & Gloss. Help clients choose between styling services or simple trims. Use friendly, upbeat language.",
  "real-estate":
    "You are a high-end property consultant. Focus on qualifying leads by asking for their budget and locations before booking a viewing.",
  general:
    "You are a helpful AI assistant. Answer questions clearly and professionally.",
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

function sanitizeHttpUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
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
        host === "woodpetra.in" &&
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
            className="break-all text-blue-600 underline hover:text-blue-700"
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function normalizeTranscript(text: string) {
  return text
    .replace(/\btshirt\b/gi, "T-shirt")
    .replace(/\bt shirts\b/gi, "T-shirts")
    .replace(/\bt shirt\b/gi, "T-shirt")
    .replace(/\bear buds\b/gi, "earbuds")
    .replace(/\bear buds pro\b/gi, "Earbuds Pro")
    .replace(/\bi wanna\b/gi, "I want to")
    .replace(/\bwana\b/gi, "want to")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPrice(price: number | string | undefined) {
  if (price === undefined || price === null || price === "") {
    return null;
  }

  const numericPrice =
    typeof price === "number" ? price : Number(String(price).trim());

  if (Number.isFinite(numericPrice)) {
    return `Rs.${numericPrice}`;
  }

  return `Rs.${String(price).trim()}`;
}

function normalizeApiPayload(input: unknown): Record<string, any> {
  if (Array.isArray(input)) {
    const firstItem = input[0];
    if (firstItem && typeof firstItem === "object") {
      return firstItem as Record<string, any>;
    }
    return {};
  }

  if (input && typeof input === "object") {
    return input as Record<string, any>;
  }

  return {};
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
  const [isRecording, setIsRecording] = useState(false);
  const [enterpriseImage, setEnterpriseImage] =
    useState<EnterpriseImageAttachment | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const listeningEnabledRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeBotId = chatbotId || "9ff1f58c-d09d-4449-97cc-a5860b640e2c";
  const isEnterprisePlan = String(plan || "").toLowerCase() === "enterprise";

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

  useEffect(() => {
    return () => {
      listeningEnabledRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  const stopRecognition = () => {
    listeningEnabledRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    try {
      recognitionRef.current?.stop();
    } catch {}

    recognitionRef.current = null;
    setIsRecording(false);
  };

  const startRecognition = () => {
    const RecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      window.alert("Speech-to-text is not supported in this browser.");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.lang = niche === "ecommerce" ? "en-US" : "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setIsRecording(true);
    };

    recognition.onresult = (event: SpeechRecognitionEventLite) => {
      const startIndex = event.resultIndex ?? 0;
      let appendedFinal = "";
      let currentInterim = "";

      for (let i = startIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript?.trim() || "";

        if (!transcript) continue;

        if (result?.isFinal) {
          appendedFinal += `${transcript} `;
        } else {
          currentInterim += `${transcript} `;
        }
      }

      if (appendedFinal.trim()) {
        finalTranscriptRef.current = normalizeTranscript(
          `${finalTranscriptRef.current} ${appendedFinal}`.trim()
        );
      }

      const liveText = normalizeTranscript(
        `${finalTranscriptRef.current} ${currentInterim}`.trim()
      );

      setUserInput(liveText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event?.error);

      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        stopRecognition();
        window.alert("Microphone permission is blocked. Please allow microphone access.");
        return;
      }

      if (event?.error === "no-speech") {
        return;
      }

      setIsRecording(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (!listeningEnabledRef.current) {
        setIsRecording(false);
        return;
      }

      restartTimeoutRef.current = setTimeout(() => {
        if (listeningEnabledRef.current) {
          startRecognition();
        }
      }, 250);
    };

    recognition.start();
  };

  const toggleVoiceRecognition = () => {
    if (!isEnterprisePlan || isLoading) return;

    if (isRecording || listeningEnabledRef.current) {
      stopRecognition();
      return;
    }

    finalTranscriptRef.current = userInput.trim();
    listeningEnabledRef.current = true;
    startRecognition();
  };

  const attachImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      window.alert("Please upload an image file only.");
      return;
    }

    const dataUrl = await fileToDataUrl(file);

    setEnterpriseImage({
      name: file.name,
      type: file.type,
      dataUrl,
    });
  };

  const handleImageSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await attachImageFile(file);
    event.target.value = "";
  };

  const handlePaste = async (event: ClipboardEvent<HTMLInputElement>) => {
    if (!isEnterprisePlan) return;

    const items = event.clipboardData?.items;
    if (!items?.length) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          await attachImageFile(file);
          return;
        }
      }
    }
  };

  const clearImageAttachment = () => {
    setEnterpriseImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSendMessage = async () => {
    const trimmedInput = userInput.trim();

    if (isLoading || (!trimmedInput && !enterpriseImage)) {
      return;
    }

    let uniqueSessionId = localStorage.getItem(`chat_session_${activeBotId}`);
    if (!uniqueSessionId) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      const secureRandom = array[0].toString(36);
      uniqueSessionId = `session_${secureRandom}_${Date.now()}`;
      localStorage.setItem(`chat_session_${activeBotId}`, uniqueSessionId);
    }

    const messageText =
      trimmedInput ||
      `Image attached: ${enterpriseImage?.name || "Untitled image"}`;

    const payload = {
      message: messageText,
      bot_id: activeBotId,
      conversation_id: uniqueSessionId,
      category: botCategory,
      niche,
      system_instructions: PROMPTS[niche] || PROMPTS.general,
      image_name: enterpriseImage?.name || null,
      image_type: enterpriseImage?.type || null,
      image_data_url: enterpriseImage?.dataUrl || null,
      channel: "website",
    };

    const newMessages: Message[] = [
      ...messages,
      {
        role: "user",
        content: messageText,
        imagePreviewUrl: enterpriseImage?.dataUrl,
        imageName: enterpriseImage?.name,
      },
    ];

    setMessages(newMessages);
    setUserInput("");
    setEnterpriseImage(null);
    setIsLoading(true);

    stopRecognition();
    finalTranscriptRef.current = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawData = await response.json();
      const data = normalizeApiPayload(rawData);

      if (response.status === 429) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content:
              "Too many messages. Please wait a few seconds before trying again.",
          },
        ]);
        return;
      }

      if (!response.ok) {
        throw new Error(data?.reply || data?.message || "Server Error");
      }

      // Secure product layout and routing link detection
      const redirectCandidate =
        typeof data.product_url === "string" && data.product_url.trim()
          ? data.product_url.trim()
          : typeof data.website_url === "string" && data.website_url.trim()
          ? data.website_url.trim()
          : typeof data.redirect_url === "string" && data.redirect_url.trim()
          ? data.redirect_url.trim()
          : typeof data.payment_link === "string" && data.payment_link.trim()
          ? data.payment_link.trim()
          : null;

      const safeActionUrl = redirectCandidate
        ? sanitizeHttpUrl(redirectCandidate)
        : null;

      let actionLabel: string | undefined;

      if (safeActionUrl) {
        const lowerUrl = safeActionUrl.toLowerCase();

        if (data.type === "product" || data.name || niche === "ecommerce") {
          actionLabel = "View Product";
        } else if (lowerUrl.includes("/contact")) {
          actionLabel = "Contact Us";
        } else {
          actionLabel = "Open Page";
        }
      }

      // Force structure fallback layout matching if any property confirms it is a product
      if (data.type === "product" || data.name || data.price || data.product_url) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            messageType: "product",
            content:
              typeof data.message === "string" && data.message.trim()
                ? data.message.trim()
                : "Here is a product you may like.",
            productName:
              typeof data.name === "string" ? data.name.trim() : undefined,
            productDescription:
              typeof data.description === "string"
                ? data.description.trim()
                : undefined,
            productPrice:
              typeof data.price === "number" || typeof data.price === "string"
                ? data.price
                : undefined,
            productImageUrl:
              typeof data.image_url === "string"
                ? data.image_url.trim()
                : undefined,
            productCategory:
              typeof data.category === "string"
                ? data.category.trim()
                : undefined,
            productUrl: safeActionUrl || undefined,
            actionUrl: safeActionUrl || undefined,
            actionLabel: actionLabel || "View Product",
          },
        ]);
        return;
      }

      // Default Standard Text Rendering State
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          messageType: "text",
          content:
            (typeof data.reply === "string" && data.reply.trim()) ||
            (typeof data.message === "string" && data.message.trim()) ||
            "I received your message but have no response.",
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

  const IconButton = ({
    onClick,
    title,
    active = false,
    children,
  }: {
    onClick: () => void;
    title: string;
    active?: boolean;
    children: ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
        active
          ? "border-red-300 bg-red-50 text-red-600 shadow-sm"
          : "border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
      }`}
    >
      {children}
    </button>
  );

  const chatPanel = (
    <div
      className={`flex flex-col overflow-hidden border bg-white shadow-2xl transition-all duration-300 ${
        isEmbed
          ? "h-full w-full rounded-2xl"
          : "h-[450px] w-[92vw] rounded-2xl sm:w-[350px]"
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
            x
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-3 overscroll-contain"
      >
        {messages.map((m, i) => {
          const { safeUrl, cleanText } = processMessageContent(m.content);
          const actionUrl = m.actionUrl || safeUrl;
          const productActionUrl = m.productUrl || actionUrl;
          const actionLabel =
            m.actionLabel || (niche === "ecommerce" ? "Buy Now" : "Open Page");
          const formattedPrice = formatPrice(m.productPrice);

          return (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl p-2 text-xs shadow-sm md:text-sm ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "border bg-white text-gray-800"
                }`}
              >
                {m.messageType === "product" ? (
                  <div className="w-full min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white text-left">
                    {m.productImageUrl && (
                      <img
                        src={m.productImageUrl}
                        alt={m.productName || "Product"}
                        className="h-40 w-full object-cover"
                      />
                    )}

                    <div className="space-y-2 p-3">
                      {m.productName && (
                        <div className="text-base font-bold text-gray-900">
                          {m.productName}
                        </div>
                      )}

                      {formattedPrice && (
                        <div className="text-sm font-semibold text-blue-700">
                          {formattedPrice}
                        </div>
                      )}

                      {m.productDescription && (
                        <div className="text-sm leading-relaxed text-gray-600">
                          {m.productDescription}
                        </div>
                      )}

                      {m.productCategory && (
                        <div className="text-xs text-gray-400">
                          {m.productCategory}
                        </div>
                      )}

                      {m.content && (
                        <div className="border-t border-gray-100 pt-2 text-sm text-gray-700">
                          {renderTextWithLinks(m.content)}
                        </div>
                      )}

                      {productActionUrl && (
                        <button
                          type="button"
                          onClick={() => handleOpen(productActionUrl)}
                          className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-center font-bold text-white transition hover:bg-blue-700"
                        >
                          {m.actionLabel || "View Product"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      {safeUrl
                        ? "Click below to complete your order:"
                        : renderTextWithLinks(cleanText)}
                    </div>

                    {m.imagePreviewUrl && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <img
                          src={m.imagePreviewUrl}
                          alt={m.imageName || "Uploaded image"}
                          className="max-h-40 w-full object-cover"
                        />
                        {m.imageName && (
                          <div className="border-t border-gray-200 px-2 py-1 text-[10px] text-gray-500">
                            {m.imageName}
                          </div>
                        )}
                      </div>
                    )}

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
                  </>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="animate-pulse text-xs text-gray-400">
            Assistant is typing...
          </div>
        )}
      </div>

      <div className="shrink-0 border-t bg-white p-2">
        {isEnterprisePlan && (
          <div className="mb-2 flex items-center gap-2">
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              title="Upload image"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </IconButton>

            <IconButton
              onClick={toggleVoiceRecognition}
              title={isRecording ? "Stop voice input" : "Voice to text"}
              active={isRecording}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10a7 7 0 0 1-14 0" />
                <path d="M12 19v4" />
                <path d="M8 23h8" />
              </svg>
            </IconButton>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelection}
            />

            <div className="text-[11px] text-blue-700">
              {isRecording ? "Listening..." : "Enterprise tools"}
            </div>
          </div>
        )}

        {isEnterprisePlan && enterpriseImage && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-[11px] text-gray-600">
            <span className="truncate pr-2">
              Attached image: {enterpriseImage.name}
            </span>
            <button
              type="button"
              onClick={clearImageAttachment}
              className="rounded bg-white px-2 py-1 text-gray-500 hover:text-red-600"
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => {
              setUserInput(e.target.value);
              finalTranscriptRef.current = e.target.value;
            }}
            onPaste={handlePaste}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder={
              isEnterprisePlan
                ? "Type, paste image, speak, or upload image..."
                : "Type your message..."
            }
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
              href="https://woodpetra.in"
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