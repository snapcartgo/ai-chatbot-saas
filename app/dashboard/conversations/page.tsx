"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ConversationsPage() {
  const [groupedMessages, setGroupedMessages] = useState<Record<string, any[]>>({});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);

      // 1. Get logged user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Get user chatbots
      const { data: bots } = await supabase
        .from("chatbots")
        .select("id")
        .eq("user_id", user.id);

      const botIds = bots?.map((b) => b.id) || [];

      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      // 3. Get messages in pages (Supabase returns 1000 rows per page by default)
      // 3. Get messages in pages
const pageSize = 1000;
let from = 0;
const allMessages: any[] = [];

while (true) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, created_at, bot_id")
    .in("bot_id", botIds)
    .order("created_at", { ascending: true })
    .range(from, from + pageSize - 1); // 0-999, 1000-1999, ...

  if (error) {
    console.error("Failed to load messages:", error);
    break;
  }

  if (!data || data.length === 0) break;

  allMessages.push(...data);

  if (data.length < pageSize) break; // last page reached
  from += pageSize;
}

// Group only after all pages are merged
if (allMessages.length > 0) {
  const groups = allMessages.reduce((acc: Record<string, any[]>, msg) => {
    const id = msg.conversation_id || "unknown_session";
    if (!acc[id]) acc[id] = [];
    acc[id].push(msg);
    return acc;
  }, {});

  const sortedEntries = Object.entries(groups).sort((a: any, b: any) => {
    const lastTimeA = new Date(a[1][a[1].length - 1].created_at).getTime();
    const lastTimeB = new Date(b[1][b[1].length - 1].created_at).getTime();
    return lastTimeB - lastTimeA;
  });

  setGroupedMessages(Object.fromEntries(sortedEntries) as Record<string, any[]>);
} else {
  setGroupedMessages({});
}


      setLoading(false);
    };

    loadMessages();
  }, []);

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto", color: "#333" }}>
      <h1 style={{ marginBottom: "20px" }}>Chat Conversations</h1>

      {loading && <p>Loading sessions...</p>}

      {!loading && Object.keys(groupedMessages).length === 0 && <p>No conversations yet.</p>}

      {Object.entries(groupedMessages).map(([sessionId, msgs]) => (
        <div
          key={sessionId}
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: "10px",
            marginBottom: "15px",
            overflow: "hidden",
            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          }}
        >
          <div
            onClick={() => setExpandedSession(expandedSession === sessionId ? null : sessionId)}
            style={{
              padding: "15px 20px",
              backgroundColor: "#f8f9fa",
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: "600",
              borderBottom: expandedSession === sessionId ? "1px solid #eee" : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "14px", color: "#555" }}>Session ID:</span>
              <span style={{ fontSize: "12px", fontWeight: "normal", color: "#888" }}>
                {sessionId}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "#007bff" }}>
              {expandedSession === sessionId ? "Close" : "View Conversation"}
            </span>
          </div>

          {expandedSession === sessionId && (
            <div style={{ padding: "20px", backgroundColor: "#ffffff" }}>
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    marginBottom: "15px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "10px 15px",
                      borderRadius: "15px",
                      backgroundColor: msg.role === "user" ? "#007bff" : "#f1f1f1",
                      color: msg.role === "user" ? "#ffffff" : "#333333",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      borderBottomRightRadius: msg.role === "user" ? "2px" : "15px",
                      borderBottomLeftRadius: msg.role === "user" ? "15px" : "2px",
                    }}
                  >
                    <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                  </div>
                  <span style={{ fontSize: "10px", color: "#aaa", marginTop: "4px" }}>
                    {msg.role === "user" ? "User" : "Bot"} -{" "}
                    {new Date(msg.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
