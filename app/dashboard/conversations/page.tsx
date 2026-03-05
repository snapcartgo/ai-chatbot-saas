"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ConversationsPage() {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data);
      }
    };

    loadMessages();
  }, []);

  return (
    <div style={{ padding: "30px" }}>
      <h1>Conversations</h1>

      {messages.map((msg) => (
        <div key={msg.id} style={{ marginBottom: "10px" }}>
          <strong>{msg.role}</strong>: {msg.content}
        </div>
      ))}
    </div>
  );
}