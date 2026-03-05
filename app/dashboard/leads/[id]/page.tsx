"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function LeadDetailPage() {
  const params = useParams();
  const leadId = params.id;

  const [lead, setLead] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    async function loadLead() {

      // Fetch lead details
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();

      if (leadData) {
        setLead(leadData);

        // Fetch conversation messages
        const { data: chat } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", leadData.conversation_id)
          .order("created_at", { ascending: true });

        if (chat) {
          setMessages(chat);
        }
      }
    }

    if (leadId) {
      loadLead();
    }
  }, [leadId]);

  if (!lead) {
    return <div style={{ padding: 30 }}>Loading lead...</div>;
  }

  return (
    <div style={{ padding: "30px" }}>
      
      <h1 style={{ fontSize: "24px", marginBottom: "20px" }}>
        Lead Details
      </h1>

      {/* Lead Info */}
      <div style={{ marginBottom: "30px" }}>
        <p><strong>Name:</strong> {lead.name}</p>
        <p><strong>Phone:</strong> {lead.phone}</p>
        <p><strong>Email:</strong> {lead.email}</p>
        <p><strong>Service:</strong> {lead.service}</p>
        <p><strong>Budget:</strong> {lead.budget}</p>
        <p><strong>Status:</strong> {lead.lead_status}</p>
      </div>

      {/* Conversation */}
      <h2 style={{ marginBottom: "10px" }}>Conversation</h2>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          background: "#f9f9f9"
        }}
      >
        {messages.length === 0 && <p>No messages found.</p>}

        {messages.map((msg: any) => (
            <div
                key={msg.id}
                style={{
                marginBottom: "10px",
                padding: "12px",
                background: msg.role === "user" ? "#dbeafe" : "#e5e7eb",
                borderRadius: "6px",
                color: "#000000",
                fontSize: "15px"
                }}
            >
                <strong style={{ color: "#111827" }}>{msg.role}:</strong>{" "}
                <span style={{ color: "#000000" }}>{msg.content}</span>
            </div>
            ))}
      </div>

    </div>
  );
}