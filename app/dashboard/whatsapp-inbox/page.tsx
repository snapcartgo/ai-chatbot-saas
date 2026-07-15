"use client";

import { useEffect, useState, useRef } from "react"; // 🟢 Added useRef here
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

type ConversationGroups = Record<string, MessageRow[]>;

// 1. Isolated Sub-Component to keep React Hooks in line and prevent hydration/ordering errors
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

  // 🟢 1. Create the Scroll Anchor DOM Target Reference Hook here
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  const activeChatMessages = activeSessionId ? whatsappGroups[activeSessionId] : [];

  // 🟢 2. Automatically snap scroll window down whenever messages stream data swaps or updates
  // Automatically snap scroll window down whenever messages stream data swaps or updates
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    };

    // 1. Run immediately for instant text transitions
    scrollToBottom();

    // 2. Run slightly delayed to account for product image loading layout shifts
    const timer = setTimeout(scrollToBottom, 250);

    return () => clearTimeout(timer);
  }, [activeChatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!typedMessage.trim() || !activeSessionId) return;

    const currentCleanPhone = activeSessionId.includes("conv_") 
      ? activeSessionId.replace("conv_", "") 
      : activeSessionId;

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

        if (dbError) {
          console.error("Supabase rejected insertion row details:", dbError.message);
        } else {
          if (dbInsertedData && dbInsertedData[0]) {
            setWhatsappGroups((prev) => ({
              ...prev,
              [activeSessionId]: [...(prev[activeSessionId] || []), dbInsertedData[0]]
            }));
          }
        }
      } else {
        const responseData = await response.json().catch(() => ({}));
        console.error("Backend response error structure payload:", responseData);
      }
    } catch (error) {
      console.error("Execution error within handleSendMessage runtime context:", error);
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
              <h4 className="font-bold text-sm text-white">
                Chatting with: {activeSessionId.replace("conv_", "")}
              </h4>
            </div>

            {/* Message Stream */}
{/* 🟢 CHANGED: Removed space-y-4 from this parent div container */}
<div className="flex-1 p-6 overflow-y-auto flex flex-col bg-[#0b141a]">
  {activeChatMessages.map((msg, index) => {
    const isProductImage = msg.content?.startsWith("[Sent Image:");
    const formattedTime = formatMessageTime(msg.created_at);

    // Dynamic Date Badge Logic
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

        {/* 🟢 CHANGED: Added 'mb-4' here to guarantee clean spacing between bubbles */}
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
              className="p-4 bg-[#202c33] flex gap-2 border-t border-gray-800"
            >
              <input
                type="text"
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                placeholder="Type manual response..."
                className="flex-1 bg-[#2a3942] rounded-lg p-2.5 text-xs text-white focus:outline-none placeholder-gray-500"
              />
              <button
                type="submit"
                className="bg-[#00a884] hover:bg-[#008f72] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
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