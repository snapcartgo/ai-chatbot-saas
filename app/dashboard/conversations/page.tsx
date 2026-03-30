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
      const { data: { user } } = await supabase.auth.getUser();
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

      // 3. Get messages using bot_id (Avoids the conversation_id text prefix issue)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("bot_id", botIds)
        .order("created_at", { ascending: true }); // Chronological order (oldest to newest)

      if (!error && data) {
        // Group messages by conversation_id
        const groups = data.reduce((acc: any, msg) => {
          const id = msg.conversation_id || "unknown_session";
          if (!acc[id]) acc[id] = [];
          acc[id].push(msg);
          return acc;
        }, {});
        setGroupedMessages(groups);
      }

      setLoading(false);
    };

    loadMessages();
  }, []);

  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto", color: "#333" }}>
      <h1 style={{ marginBottom: "20px" }}>Chat Conversations</h1>

      {loading && <p>Loading sessions...</p>}

      {!loading && Object.keys(groupedMessages).length === 0 && (
        <p>No conversations yet.</p>
      )}

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
          {/* Header Box - Clickable */}
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
              <span style={{ fontSize: "12px", fontWeight: "normal", color: "#888" }}>{sessionId}</span>
            </div>
            <span style={{ fontSize: "12px", color: "#007bff" }}>
              {expandedSession === sessionId ? "▲ Close" : "▼ View Conversation"}
            </span>
          </div>

          {/* Chat Content - Visible when expanded */}
          {expandedSession === sessionId && (
            <div style={{ padding: "20px", backgroundColor: "#ffffff" }}>
              {msgs.map((msg) => (
                <div
                  key={msg.id} // Correctly placed unique key
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
                    {msg.role === "user" ? "User" : "Bot"} • {
                      new Date(msg.created_at).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })
                    }
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