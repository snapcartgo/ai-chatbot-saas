"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ConversationsPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);

      // 1️⃣ Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // 2️⃣ Get the IDs of all chatbots owned by this user
      const { data: bots } = await supabase
        .from("chatbots")
        .select("id")
        .eq("user_id", user.id);

      const botIds = bots?.map((b) => b.id) || [];

      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      // 3️⃣ Get messages directly using bot_id (Skips the conversation_id prefix issue)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("bot_id", botIds) // Using the UUID column directly
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data);
      } else if (error) {
        console.error("Supabase Error:", error.message);
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