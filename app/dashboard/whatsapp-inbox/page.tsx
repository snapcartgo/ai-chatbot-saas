"use client";

import { useEffect, useState, useRef } from "react";
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

// 1. Isolated Sub-Component to keep React Hooks in line
function ProductMessageBubble({ msg }: { msg: MessageRow; supabase: any }) {
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

const formatMessageTime = (isoString: string | null) => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch (e) {
    return "";
  }
};

// 2. Main Page Module Container
export default function WhatsAppInboxPage() {
  const supabase = createClient();
  const [whatsappGroups, setWhatsappGroups] = useState<ConversationGroups>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [typedMessage, setTypedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiMode, setAiMode] = useState<"active" | "human">("active");

  // ⚡ Template Feature State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load chats
  useEffect(() => {
    const loadWhatsAppChats = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: bots } = await supabase
        .from("chatbots")
        .select("id")
        .eq("user_id", user.id);

      const botIds = bots?.map((bot) => bot.id) || [];

      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("bot_id", botIds)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Fetch Error:", error.message);
        setLoading(false);
        return;
      }

      if (data) {
        const whatsapp: ConversationGroups = {};

        data.forEach((msg: MessageRow) => {
          const id = msg.conversation_id || "no_id";
          if (msg.channel === "whatsapp") {
            if (!whatsapp[id]) whatsapp[id] = [];
            whatsapp[id].push(msg);
          }
        });

        const sortByNewest = (obj: ConversationGroups) => {
          return Object.fromEntries(
            Object.entries(obj).sort((a, b) => {
              const timeA = new Date(a[1][a[1].length - 1]?.created_at || 0).getTime();
              const timeB = new Date(b[1][b[1].length - 1]?.created_at || 0).getTime();
              return timeB - timeA;
            })
          );
        };

        setWhatsappGroups(sortByNewest(whatsapp));
      }

      setLoading(false);
    };

    loadWhatsAppChats();
  }, [supabase]);

  // ⚡ Load APPROVED templates for selector dropdown
  useEffect(() => {
    const loadTemplates = async () => {
      console.log("Checking template table records...");
      
      // Select everything (*) to avoid column mismatch errors
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*");

      if (error) {
        console.error("Supabase templates read error:", error.message);
        return;
      }

      console.log("Raw table payload received:", data);

      if (data) {
        // Filter APPROVED templates safely
        const approvedOnly = data.filter(
          (t) => t.status?.trim().toUpperCase() === "APPROVED"
        );
        
        // Map data to ensure template_name is populated whether the column is 'name' or 'template_name'
        const normalizedTemplates = approvedOnly.map((t) => ({
          template_name: t.name || t.template_name || "Unnamed Template",
          language: t.language || "en",
          status: t.status
        }));

        console.log("Matched dropdown items:", normalizedTemplates);
        setTemplates(normalizedTemplates);
      }
    };
    loadTemplates();
  }, [supabase]);

  useEffect(() => {
  if (!activeSessionId) return;

  const loadAiMode = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("ai_mode")
      .eq("conversation_id", activeSessionId)
      .single();

    if (data) {
      setAiMode(data.ai_mode || "active");
    }
  };

  loadAiMode();
}, [activeSessionId]);

  const activeChatMessages = activeSessionId ? whatsappGroups[activeSessionId] : [];

  // Auto Scroll Window
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 250);
    return () => clearTimeout(timer);
  }, [activeChatMessages]);

  const currentCleanPhone = activeSessionId?.includes("conv_") 
    ? activeSessionId.replace("conv_", "") 
    : activeSessionId || "";

  // ⚡ Send Template handler
  const handleSendTemplate = async () => {
    if (!selectedTemplate || !activeSessionId) return;
    setSendingTemplate(true);

    try {
      const currentChatMessages = whatsappGroups[activeSessionId] || [];
      const activeBotId = currentChatMessages.find((m) => m.bot_id)?.bot_id || null;

      const res = await fetch("/api/whatsapp/send-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: selectedTemplate.template_name,
          languageCode: selectedTemplate.language,
          recipientPhone: currentCleanPhone,
        }),
      });

      if (res.ok) {
        // Insert template message event inside database dynamically to show up immediately in stream
        const { data: dbInsertedData } = await supabase
          .from("messages")
          .insert({
            conversation_id: activeSessionId,
            bot_id: activeBotId,
            role: "assistant", 
            content: `⚡ Template Sent: ${selectedTemplate.template_name}`,
            channel: "whatsapp"
          })
          .select();

        if (dbInsertedData && dbInsertedData[0]) {
          setWhatsappGroups((prev) => ({
            ...prev,
            [activeSessionId]: [...(prev[activeSessionId] || []), dbInsertedData[0]]
          }));
        }

        setTemplateMenuOpen(false);
        setSelectedTemplate(null);
      } else {
        const err = await res.json();
        alert(`Failed to send template: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingTemplate(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !activeSessionId) return;

    const messageText = typedMessage;
    setTypedMessage("");

    try {
      const currentChatMessages = whatsappGroups[activeSessionId] || [];
      const activeBotId = currentChatMessages.find((m) => m.bot_id)?.bot_id || null;

      if (!activeBotId) {
        console.error("Could not trace a valid bot_id for this session mapping.");
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

      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number_id: realMetaPhoneId,
          recipient_number: currentCleanPhone,
          to: currentCleanPhone,
          message: messageText
        }),
      });

      if (response.ok) {
        const { data: dbInsertedData, error: dbError } = await supabase
          .from("messages")
          .insert({
            conversation_id: activeSessionId,
            bot_id: activeBotId,
            role: "assistant", 
            content: messageText,
            channel: "whatsapp"
          })
          .select();

        if (!dbError && dbInsertedData && dbInsertedData[0]) {
          setWhatsappGroups((prev) => ({
            ...prev,
            [activeSessionId]: [...(prev[activeSessionId] || []), dbInsertedData[0]]
          }));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleTakeOver = async () => {
  if (!activeSessionId) return;

  const { error } = await supabase
    .from("conversations")
    .update({
      ai_mode: "human",
    })
    .eq("conversation_id", activeSessionId);

  if (!error) {
    setAiMode("human");
  }
};
// 👇 Then add this immediately after
const handleResumeAI = async () => {
  if (!activeSessionId) return;

  const { error } = await supabase
    .from("conversations")
    .update({
      ai_mode: "active",
    })
    .eq("conversation_id", activeSessionId);

  if (!error) {
    setAiMode("active");
  }
};

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#0b141a] text-white overflow-hidden rounded-xl border border-gray-800 m-2">
      
      {/* LEFT PANEL: Sidebar List */}
      <div className="w-1/3 border-r border-gray-800 flex flex-col bg-[#111b21]">
        <div className="p-4 bg-[#202c33] border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">WhatsApp Live Inbox</h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
          {loading ? (
            <div className="p-4 text-xs text-gray-400 text-center">Loading live streams...</div>
          ) : Object.keys(whatsappGroups).length === 0 ? (
            <div className="p-4 text-xs text-gray-500 text-center">No active WhatsApp live chats found.</div>
          ) : (
            Object.entries(whatsappGroups).map(([sessionId, msgs]) => {
              const lastMessage = msgs[msgs.length - 1];
              const cleanDisplayName = sessionId.startsWith("conv_") ? sessionId.replace("conv_", "") : sessionId;

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

      {/* RIGHT PANEL: Chat Window */}
      <div className="w-2/3 flex flex-col bg-[#0b141a]">
        {activeSessionId ? (
          <>
            {/* Header */}
            <div className="p-4 bg-[#202c33] border-b border-gray-800">
              <div className="p-4 bg-[#202c33] border-b border-gray-800">
  <div className="flex items-center justify-between">

    <h4 className="font-bold text-sm text-white">
      Chatting with: {currentCleanPhone}
    </h4>

    {aiMode === "active" ? (
      <button
        onClick={handleTakeOver}
        className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs"
      >
        Take Over
      </button>
    ) : (
      <button
        onClick={handleResumeAI}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs"
      >
        Resume AI
      </button>
    )}

  </div>
</div>
</div>

              

            {/* Message Stream */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col bg-[#0b141a]">
              {activeChatMessages.map((msg, index) => {
                const isProductImage = msg.content?.startsWith("[Sent Image:");
                const formattedTime = formatMessageTime(msg.created_at);

                let showDateBadge = false;
                let dateBadgeText = "";

                if (msg.created_at) {
                  const currentMsgDate = new Date(msg.created_at).toLocaleDateString([], {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });

                  const prevMsg = index > 0 ? activeChatMessages[index - 1] : null;
                  const prevMsgDate = prevMsg?.created_at
                    ? new Date(prevMsg.created_at).toLocaleDateString([], {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : null;

                  if (currentMsgDate !== prevMsgDate) {
                    showDateBadge = true;
                    const todayStr = new Date().toLocaleDateString([], {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                    dateBadgeText = currentMsgDate === todayStr ? "Today" : currentMsgDate;
                  }
                }

                return (
                  <div key={msg.id} className="contents">
                    {showDateBadge && (
                      <div className="flex justify-center my-4 select-none w-full">
                        <span className="bg-[#182229] text-gray-400 text-[11px] px-2.5 py-1 rounded-md shadow-sm border border-gray-800/40">
                          {dateBadgeText}
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
                        <ProductMessageBubble msg={msg} supabase={supabase} />
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

            {/* Input Action Form */}
            <form 
              onSubmit={handleSendMessage} 
              className="p-4 bg-[#202c33] flex gap-2 border-t border-gray-800 items-center relative"
            >
              {/* ⚡ TEMPLATE ACTION DROPDOWN WIDGET */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  ⚡ Template
                </button>

                {templateMenuOpen && (
                  <div className="absolute bottom-14 left-0 w-64 p-3 bg-[#111b21] border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Approved Meta Templates</p>
                    <select
                      className="w-full p-2 bg-[#2a3942] text-xs text-white border border-gray-700 rounded focus:outline-none"
                      onChange={(e) => {
                        const selected = templates.find((t) => t.template_name === e.target.value);
                        setSelectedTemplate(selected || null);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>-- Select Template --</option>
                      {templates.map((t) => (
                        <option key={t.template_name} value={t.template_name}>
                          {t.template_name} ({t.language})
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