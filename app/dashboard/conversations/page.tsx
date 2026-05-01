"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function ConversationsPage() {
  const supabase = createClient();
  const [whatsappGroups, setWhatsappGroups] = useState<any>({});
  const [websiteGroups, setWebsiteGroups] = useState<any>({});
  const [activeTab, setActiveTab] = useState<"website" | "whatsapp">("website");
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // 1. First, get all Bot IDs that belong to you
      const { data: bots } = await supabase
        .from("chatbots")
        .select("id")
        .eq("user_id", user.id);

      const botIds = bots?.map(bot => bot.id) || [];

      if (botIds.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Query messages linked to YOUR bots
      // This will catch website messages even if user_id is NULL
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("bot_id", botIds) // Matches any message from your bots
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Fetch Error:", error.message);
        setLoading(false);
        return;
      }

      if (data) {
        const whatsapp: any = {};
        const website: any = {};

        data.forEach((msg: any) => {
          const id = msg.conversation_id || "no_id";
          
          // Separate based on the 'channel' column from your screenshot
          if (msg.channel === 'whatsapp') {
            if (!whatsapp[id]) whatsapp[id] = [];
            whatsapp[id].push(msg);
          } else {
            // This catches 'website' channel or anything else
            if (!website[id]) website[id] = [];
            website[id].push(msg);
          }
        });

        // Sorting logic
        const sortByNewest = (obj: any) => {
          return Object.fromEntries(
            Object.entries(obj).sort((a: any, b: any) => {
              const timeA = new Date(a[1][a[1].length - 1].created_at).getTime();
              const timeB = new Date(b[1][b[1].length - 1].created_at).getTime();
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
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto", color: "#333" }}>
      <h2 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "30px" }}>Conversations History</h2>

      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <button 
          onClick={() => setActiveTab("website")}
          style={{
            padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer",
            backgroundColor: activeTab === "website" ? "#007bff" : "#e2e8f0",
            color: activeTab === "website" ? "white" : "#475569",
            fontWeight: "bold"
          }}
        >
          Website ({Object.keys(websiteGroups).length})
        </button>
        <button 
          onClick={() => setActiveTab("whatsapp")}
          style={{
            padding: "12px 24px", borderRadius: "8px", border: "none", cursor: "pointer",
            backgroundColor: activeTab === "whatsapp" ? "#25D366" : "#e2e8f0",
            color: activeTab === "whatsapp" ? "white" : "#475569",
            fontWeight: "bold"
          }}
        >
          WhatsApp ({Object.keys(whatsappGroups).length})
        </button>
      </div>

      {loading ? (
        <p>Loading your conversations...</p>
      ) : Object.keys(currentGroups).length === 0 ? (
        <div style={{ padding: "60px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "12px" }}>
          No {activeTab} conversations found.
        </div>
      ) : (
        Object.entries(currentGroups).map(([sessionId, msgs]: any) => (
          <div key={sessionId} style={{ border: "1px solid #e2e8f0", borderRadius: "12px", marginBottom: "10px", overflow: "hidden" }}>
            <div 
              onClick={() => setExpandedSession(expandedSession === sessionId ? null : sessionId)}
              style={{ padding: "20px", cursor: "pointer", backgroundColor: "#fff", display: "flex", justifyContent: "space-between" }}
            >
              <div>
                <strong>ID: {sessionId.substring(0, 15)}...</strong>
                <div style={{ fontSize: "12px", color: "#666" }}>Messages: {msgs.length}</div>
              </div>
              <span style={{ color: "#007bff" }}>{expandedSession === sessionId ? "Close" : "Open Chat"}</span>
            </div>
            {expandedSession === sessionId && (
              <div style={{ padding: "20px", borderTop: "1px solid #e2e8f0", backgroundColor: "#fdfdfd" }}>
                {msgs.map((m: any) => (
                  <div key={m.id} style={{ marginBottom: "10px", textAlign: m.role === 'user' ? 'right' : 'left' }}>
                    <div style={{ 
                      display: "inline-block", padding: "10px 15px", borderRadius: "15px", fontSize: "14px",
                      backgroundColor: m.role === 'user' ? "#007bff" : "#f1f5f9",
                      color: m.role === 'user' ? "white" : "black"
                    }}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}