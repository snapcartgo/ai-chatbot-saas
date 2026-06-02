"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type MessageRow = {
  id: string;
  conversation_id: string | null;
  role: "user" | "assistant";
  content: string | null;
  created_at: string | null;
  channel?: string | null;
};

type ConversationGroups = Record<string, MessageRow[]>;

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ConversationsPage() {
  const supabase = createClient();
  const [whatsappGroups, setWhatsappGroups] = useState<ConversationGroups>({});
  const [websiteGroups, setWebsiteGroups] = useState<ConversationGroups>({});
  const [activeTab, setActiveTab] = useState<"website" | "whatsapp">("website");
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
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
        const website: ConversationGroups = {};

        data.forEach((msg: MessageRow) => {
          const id = msg.conversation_id || "no_id";

          if (msg.channel === "whatsapp") {
            if (!whatsapp[id]) whatsapp[id] = [];
            whatsapp[id].push(msg);
          } else {
            if (!website[id]) website[id] = [];
            website[id].push(msg);
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
        setWebsiteGroups(sortByNewest(website));
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const currentGroups = activeTab === "whatsapp" ? whatsappGroups : websiteGroups;

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "1200px",
        margin: "0 auto",
        color: "#333",
      }}
    >
      <h2
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          marginBottom: "30px",
        }}
      >
        Conversations History
      </h2>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("website")}
          style={{
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            backgroundColor: activeTab === "website" ? "#007bff" : "#e2e8f0",
            color: activeTab === "website" ? "white" : "#475569",
            fontWeight: "bold",
          }}
        >
          Website ({Object.keys(websiteGroups).length})
        </button>

        <button
          onClick={() => setActiveTab("whatsapp")}
          style={{
            padding: "12px 24px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            backgroundColor: activeTab === "whatsapp" ? "#25D366" : "#e2e8f0",
            color: activeTab === "whatsapp" ? "white" : "#475569",
            fontWeight: "bold",
          }}
        >
          WhatsApp ({Object.keys(whatsappGroups).length})
        </button>
      </div>

      {loading ? (
        <p>Loading your conversations...</p>
      ) : Object.keys(currentGroups).length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
          }}
        >
          No {activeTab} conversations found.
        </div>
      ) : (
        Object.entries(currentGroups).map(([sessionId, msgs]) => {
          const firstMessage = msgs[0];
          const lastMessage = msgs[msgs.length - 1];

          return (
            <div
              key={sessionId}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                marginBottom: "10px",
                overflow: "hidden",
              }}
            >
              <div
                onClick={() =>
                  setExpandedSession(expandedSession === sessionId ? null : sessionId)
                }
                style={{
                  padding: "20px",
                  cursor: "pointer",
                  backgroundColor: "#fff",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "16px",
                }}
              >
                <div>
                  <strong>ID: {sessionId.substring(0, 15)}...</strong>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                    Messages: {msgs.length}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                    Started: {formatDateTime(firstMessage?.created_at)}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                    Last message: {formatDateTime(lastMessage?.created_at)}
                  </div>
                </div>

                <span style={{ color: "#007bff", whiteSpace: "nowrap" }}>
                  {expandedSession === sessionId ? "Close" : "Open Chat"}
                </span>
              </div>

              {expandedSession === sessionId && (
                <div
                  style={{
                    padding: "20px",
                    borderTop: "1px solid #e2e8f0",
                    backgroundColor: "#fdfdfd",
                  }}
                >
                  {msgs.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        marginBottom: "14px",
                        textAlign: m.role === "user" ? "right" : "left",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          maxWidth: "78%",
                        }}
                      >
                        <div
                          style={{
                            display: "inline-block",
                            padding: "10px 15px",
                            borderRadius: "15px",
                            fontSize: "14px",
                            backgroundColor: m.role === "user" ? "#007bff" : "#f1f5f9",
                            color: m.role === "user" ? "white" : "black",
                            wordBreak: "break-word",
                          }}
                        >
                          {m.content || "No content"}
                        </div>

                        <div
                          style={{
                            fontSize: "11px",
                            color: "#64748b",
                            marginTop: "5px",
                            paddingLeft: m.role === "user" ? "0" : "4px",
                            paddingRight: m.role === "user" ? "4px" : "0",
                          }}
                        >
                          {formatDateTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}