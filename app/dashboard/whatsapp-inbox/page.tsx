"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type MessageRow = {
  id: string;
  conversation_id: string | null;
  bot_id?: string | null;
  role: "user" | "assistant";
  content: string | null;
  created_at: string | null;
  channel?: string | null;
  image_url?: string | null;
};

type Template = {
  template_name: string;
  language: string;
  status: string;
};

type ConversationGroups = Record<string, MessageRow[]>;

function ProductMessageBubble({ msg }: { msg: MessageRow }) {
  const imageUrl = msg.image_url;

  return (
    <div className="flex flex-col gap-2">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Product View"
          className="rounded-md max-w-full h-auto object-cover bg-white p-1 max-h-[200px]"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-[180px] h-[150px] bg-gray-700 rounded flex items-center justify-center text-gray-400 text-[10px]">
          No image link stored
        </div>
      )}

      <p className="whitespace-pre-line text-[11px] text-gray-200 bg-black/20 p-2 rounded">
        {msg.content || ""}
      </p>
    </div>
  );
}

function formatMessageTime(isoString: string | null) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function formatDateBadge(isoString: string | null) {
  if (!isoString) return "";
  const msgDate = new Date(isoString);
  const today = new Date();

  const msgDateOnly = new Date(
    msgDate.getFullYear(),
    msgDate.getMonth(),
    msgDate.getDate()
  );
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  if (msgDateOnly.getTime() === todayOnly.getTime()) {
    return "Today";
  }

  return msgDate.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function WhatsAppInboxPage() {
  const supabase = useMemo(() => createClient(), []);
  const [whatsappGroups, setWhatsappGroups] = useState<ConversationGroups>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiMode, setAiMode] = useState<"active" | "human">("active");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadWhatsAppChats = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWhatsappGroups({});
      setLoading(false);
      return;
    }

    const { data: bots, error: botsError } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id);

    if (botsError) {
      console.error("Bots fetch error:", botsError.message);
      setLoading(false);
      return;
    }

    const botIds = (bots || []).map((bot) => bot.id).filter(Boolean);

    if (botIds.length === 0) {
      setWhatsappGroups({});
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("bot_id", botIds)
      .eq("channel", "whatsapp")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages fetch error:", error.message);
      setLoading(false);
      return;
    }

    const grouped: ConversationGroups = {};

    (data || []).forEach((msg: MessageRow) => {
      const conversationId = msg.conversation_id || "no_id";
      if (!grouped[conversationId]) grouped[conversationId] = [];
      grouped[conversationId].push(msg);
    });

    const sorted = Object.fromEntries(
      Object.entries(grouped).sort((a, b) => {
        const timeA = new Date(a[1][a[1].length - 1]?.created_at || 0).getTime();
        const timeB = new Date(b[1][b[1].length - 1]?.created_at || 0).getTime();
        return timeB - timeA;
      })
    );

    setWhatsappGroups(sorted);

    if (!activeSessionId && Object.keys(sorted).length > 0) {
      setActiveSessionId(Object.keys(sorted)[0]);
    }

    setLoading(false);
  }, [supabase, activeSessionId]);

  const loadTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from("whatsapp_templates")
      .select("*");

    if (error) {
      console.error("Supabase templates read error:", error.message);
      return;
    }

    const approvedTemplates = (data || [])
      .filter((item) => String(item.status || "").trim().toUpperCase() === "APPROVED")
      .map((item) => ({
        template_name: item.name || item.template_name || "Unnamed Template",
        language: item.language || "en",
        status: item.status || "",
      }));

    setTemplates(approvedTemplates);
  }, [supabase]);

  const loadAiMode = useCallback(
    async (conversationId: string) => {
      const { data, error } = await supabase
        .from("conversation_state")
        .select("ai_mode")
        .eq("conversation_id", conversationId)
        .single();

      if (error) {
        console.error("AI mode fetch error:", error.message);
        setAiMode("active");
        return;
      }

      setAiMode(data?.ai_mode === "human" ? "human" : "active");
    },
    [supabase]
  );

  useEffect(() => {
    loadWhatsAppChats();
    loadTemplates();
  }, [loadWhatsAppChats, loadTemplates]);

  useEffect(() => {
  if (!activeSessionId) return;

  const loadAiMode = async () => {
    const { data } = await supabase
      .from("conversation_state")
      .select("ai_mode")
      .eq("session_id", activeSessionId)
      .maybeSingle();

    setAiMode(data?.ai_mode ?? "active");
  };

  loadAiMode();
}, [activeSessionId]);

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async () => {
          await loadWhatsAppChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadWhatsAppChats]);

  const activeChatMessages = activeSessionId ? whatsappGroups[activeSessionId] || [] : [];

  useEffect(() => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeChatMessages]);

  const currentCleanPhone = activeSessionId?.startsWith("conv_")
    ? activeSessionId.replace("conv_", "")
    : activeSessionId || "";

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !activeSessionId) return;

    setSendingTemplate(true);

    try {
      const currentMessages = whatsappGroups[activeSessionId] || [];
      const activeBotId = currentMessages.find((m) => m.bot_id)?.bot_id || null;

      const res = await fetch("/api/whatsapp/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: selectedTemplate.template_name,
          languageCode: selectedTemplate.language,
          recipientPhone: currentCleanPhone,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send template" }));
        alert(`Failed to send template: ${err.error || "Unknown error"}`);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeSessionId,
          bot_id: activeBotId,
          role: "assistant",
          content: `Template Sent: ${selectedTemplate.template_name}`,
          channel: "whatsapp",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Template message insert error:", insertError.message);
      } else if (inserted) {
        setWhatsappGroups((prev) => ({
          ...prev,
          [activeSessionId]: [...(prev[activeSessionId] || []), inserted],
        }));
      }

      setTemplateMenuOpen(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error("Send template error:", error);
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!typedMessage.trim() || !activeSessionId) return;

    const messageText = typedMessage.trim();
    setTypedMessage("");

    try {
      const currentMessages = whatsappGroups[activeSessionId] || [];
      const activeBotId = currentMessages.find((m) => m.bot_id)?.bot_id || null;

      if (!activeBotId) {
        console.error("No valid bot_id found for this session.");
        return;
      }

      const { data: configData, error: configError } = await supabase
        .from("whatsapp_configs")
        .select("wa_phone_number_id")
        .eq("chatbot_id", activeBotId)
        .maybeSingle();

      if (configError || !configData?.wa_phone_number_id) {
        console.error("Could not find matching wa_phone_number_id:", configError?.message);
        return;
      }

      const realMetaPhoneId = configData.wa_phone_number_id;

      const response = await fetch("/api/whatsapp/send-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: realMetaPhoneId,
          recipient_number: currentCleanPhone,
          to: currentCleanPhone,
          message: messageText,
        }),
      });

      if (!response.ok) {
        console.error("Manual send failed.");
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeSessionId,
          bot_id: activeBotId,
          role: "assistant",
          content: messageText,
          channel: "whatsapp",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Manual message insert error:", insertError.message);
        return;
      }

      if (inserted) {
        setWhatsappGroups((prev) => ({
          ...prev,
          [activeSessionId]: [...(prev[activeSessionId] || []), inserted],
        }));
      }
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  const handleTakeOver = async () => {
  if (!activeSessionId) return;

  const { error } = await supabase
    .from("conversation_state")
    .upsert({
      session_id: activeSessionId,
      ai_mode: "human",
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error(error);
    return;
  }

  setAiMode("human");
};

  const handleResumeAI = async () => {
  if (!activeSessionId) return;

  const { error } = await supabase
    .from("conversation_state")
    .upsert({
      session_id: activeSessionId,
      ai_mode: "active",
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error(error);
    return;
  }

  setAiMode("active");
};

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0b141a] text-white overflow-hidden rounded-xl border border-gray-800 m-2">
      <div className="w-1/3 border-r border-gray-800 flex flex-col bg-[#111b21]">
        <div className="p-4 bg-[#202c33] border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">WhatsApp Live Inbox</h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
          {loading ? (
            <div className="p-4 text-xs text-gray-400 text-center">
              Loading live streams...
            </div>
          ) : Object.keys(whatsappGroups).length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center">
              No active WhatsApp live chats found.
            </div>
          ) : (
            Object.entries(whatsappGroups).map(([sessionId, msgs]) => {
              const lastMessage = msgs[msgs.length - 1];
              const cleanDisplayName = sessionId.startsWith("conv_")
                ? sessionId.replace("conv_", "")
                : sessionId;

              return (
                <div
                  key={sessionId}
                  onClick={() => setActiveSessionId(sessionId)}
                  className={`p-4 cursor-pointer transition-colors ${
                    activeSessionId === sessionId ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
                  }`}
                >
                  <div className="font-medium text-sm text-white">{cleanDisplayName}</div>
                  <div className="text-xs text-gray-400 mt-1 truncate max-w-[220px]">
                    {lastMessage?.content || "No message content"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="w-2/3 flex flex-col bg-[#0b141a]">
        {activeSessionId ? (
          <>
            <div className="p-4 bg-[#202c33] border-b border-gray-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-white">
                    Chatting with: {currentCleanPhone}
                  </h4>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        aiMode === "human"
                          ? "bg-red-600/20 text-red-300 border border-red-500/40"
                          : "bg-green-600/20 text-green-300 border border-green-500/40"
                      }`}
                    >
                      {aiMode === "human" ? "Human Mode" : "AI Mode"}
                    </span>
                  </div>
                </div>

                {aiMode === "active" ? (
                  <button
                    onClick={handleTakeOver}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-semibold transition-colors"
                  >
                    Take Over
                  </button>
                ) : (
                  <button
                    onClick={handleResumeAI}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs font-semibold transition-colors"
                  >
                    Resume AI
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto flex flex-col bg-[#0b141a]">
              {activeChatMessages.map((msg, index) => {
                const isProductImage = msg.content?.startsWith("[Sent Image:");
                const formattedTime = formatMessageTime(msg.created_at);

                const currentDateText = formatDateBadge(msg.created_at);
                const previousDateText =
                  index > 0
                    ? formatDateBadge(activeChatMessages[index - 1]?.created_at || null)
                    : "";

                const showDateBadge = currentDateText !== previousDateText;

                return (
                  <div key={msg.id} className="contents">
                    {showDateBadge && currentDateText && (
                      <div className="flex justify-center my-4 select-none w-full">
                        <span className="bg-[#182229] text-gray-400 text-[11px] px-2.5 py-1 rounded-md shadow-sm border border-gray-800/40">
                          {currentDateText}
                        </span>
                      </div>
                    )}

                    <div
                      className={`p-2.5 rounded-lg text-xs max-w-[70%] shadow relative flex flex-col gap-1 mb-4 ${
                        msg.role === "assistant"
                          ? "bg-[#005c4b] text-white ml-auto self-end"
                          : "bg-[#202c33] text-white self-start"
                      }`}
                    >
                      {isProductImage ? (
                        <ProductMessageBubble msg={msg} />
                      ) : (
                        <p className="whitespace-pre-line pr-10">{msg.content || ""}</p>
                      )}

                      <span
                        className={`text-[9px] select-none text-right block mt-auto self-end ${
                          msg.role === "assistant" ? "text-gray-300" : "text-gray-400"
                        }`}
                      >
                        {formattedTime}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-[#202c33] flex gap-2 border-t border-gray-800 items-center relative"
            >
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTemplateMenuOpen((prev) => !prev)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Template
                </button>

                {templateMenuOpen && (
                  <div className="absolute bottom-14 left-0 w-64 p-3 bg-[#111b21] border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Approved Meta Templates
                    </p>

                    <select
                      className="w-full p-2 bg-[#2a3942] text-xs text-white border border-gray-700 rounded focus:outline-none"
                      onChange={(e) => {
                        const selected = templates.find(
                          (t) => t.template_name === e.target.value
                        );
                        setSelectedTemplate(selected || null);
                      }}
                      value={selectedTemplate?.template_name || ""}
                    >
                      <option value="" disabled>
                        -- Select Template --
                      </option>
                      {templates.map((template) => (
                        <option
                          key={`${template.template_name}-${template.language}`}
                          value={template.template_name}
                        >
                          {template.template_name} ({template.language})
                        </option>
                      ))}
                    </select>

                    {selectedTemplate && (
                      <button
                        type="button"
                        onClick={handleSendTemplate}
                        disabled={sendingTemplate}
                        className="w-full bg-[#00a884] hover:bg-[#008f72] disabled:bg-gray-700 text-white text-xs font-semibold py-1.5 rounded transition-colors"
                      >
                        {sendingTemplate ? "Sending..." : "Confirm & Send"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Type manual response..."
                className="flex-1 bg-[#2a3942] rounded-lg p-2.5 text-xs text-white focus:outline-none placeholder-gray-500"
              />

              <button
                type="submit"
                className="bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Select a conversation session to start chatting manually
          </div>
        )}
      </div>
    </div>
  );
}