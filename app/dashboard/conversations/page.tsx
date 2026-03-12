"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ConversationsPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);

      // 1️⃣ get logged user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 2️⃣ get user chatbots
      const { data: bots } = await supabase
        .from("chatbots")
        .select("id")
        .eq("user_id", user.id);

      const botIds = bots?.map((b) => b.id) || [];

      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      // 3️⃣ get conversations for those chatbots
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .in("chatbot_id", botIds);

      const conversationIds = conversations?.map((c) => c.id) || [];

      if (conversationIds.length === 0) {
        setLoading(false);
        return;
      }

      // 4️⃣ get messages for those conversations
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data);
      }

      setLoading(false);
    };

    loadMessages();
  }, []);

  return (
    <div style={{ padding: "30px" }}>
      <h1>Conversations</h1>

      {loading && <p>Loading...</p>}

      {!loading && messages.length === 0 && (
        <p>No conversations yet.</p>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            marginBottom: "12px",
            padding: "10px",
            border: "1px solid #ddd",
            borderRadius: "6px",
          }}
        >
          <strong>{msg.role}</strong>: {msg.content}
        </div>
      ))}
    </div>
  );
}