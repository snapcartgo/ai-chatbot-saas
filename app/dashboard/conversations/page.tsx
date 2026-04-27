"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ConversationsPage() {
  const [whatsappGroups, setWhatsappGroups] = useState<any>({});
  const [websiteGroups, setWebsiteGroups] = useState<any>({});
  const [activeTab, setActiveTab] = useState<"website" | "whatsapp">("website");
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // 1. Helper: Format the timestamp for the UI
  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch Bot IDs to filter website chats
      const { data: bots } = await supabase.from("chatbots").select("id").eq("user_id", user.id);
      const botIds = bots?.map(b => b.id) || [];

      // Query the dashboard_messages view
      let query = supabase.from("dashboard_messages").select("*");
      if (botIds.length > 0) {
        query = query.or(`user_id.eq.${user.id},bot_id.in.(${botIds.join(",")})`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query.order("created_at", { ascending: true });

      if (!error && data) {
        const whatsapp: any = {};
        const website: any = {};

        data.forEach((msg: any) => {
          const id = msg.display_session_id;
          const target = msg.channel === 'whatsapp' || msg.phone_number ? whatsapp : website;
          if (!target[id]) target[id] = [];
          target[id].push(msg);
        });

        // Sort by newest message at the top
        const sortByNewest = (obj: any) => {
          return Object.entries(obj).sort((a: any, b: any) => {
            const timeA = new Date(a[1][a[1].length - 1].created_at).getTime();
            const timeB = new Date(b[1][b[1].length - 1].created_at).getTime();
            return timeB - timeA;
          });
        };

        setWhatsappGroups(Object.fromEntries(sortByNewest(whatsapp)));
        setWebsiteGroups(Object.fromEntries(sortByNewest(website)));
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const currentGroups = activeTab === "whatsapp" ? whatsappGroups : websiteGroups;

  return (
    <div style={{ padding: "30px", maxWidth: "1000px", margin: "0 auto", fontFamily: "sans-serif", color: "#333" }}>
      <h2 style={{ marginBottom: "20px", fontSize: "24px", fontWeight: "bold" }}>Conversations History</h2>

      {/* TABS */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "25px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
        <button 
          onClick={() => { setActiveTab("website"); setExpandedSession(null); }}
          style={{
            padding: "10px 20px", borderRadius: "8px", cursor: "pointer", border: "none", fontWeight: "600",
            backgroundColor: activeTab === "website" ? "#007bff" : "#f1f5f9",
            color: activeTab === "website" ? "white" : "#475569",
            transition: "all 0.2s"
          }}
        >
          Website ({Object.keys(websiteGroups).length})
        </button>
        <button 
          onClick={() => { setActiveTab("whatsapp"); setExpandedSession(null); }}
          style={{
            padding: "10px 20px", borderRadius: "8px", cursor: "pointer", border: "none", fontWeight: "600",
            backgroundColor: activeTab === "whatsapp" ? "#25D366" : "#f1f5f9",
            color: activeTab === "whatsapp" ? "white" : "#475569",
            transition: "all 0.2s"
          }}
        >
          WhatsApp ({Object.keys(whatsappGroups).length})
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>Syncing conversations...</div>
      ) : Object.keys(currentGroups).length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", color: "#94a3b8" }}>
          No {activeTab} conversations found.
        </div>
      ) : null}

      {/* CONVERSATION LIST */}
      {Object.entries(currentGroups).map(([sessionId, msgs]: any) => {
        const lastMsg = msgs[msgs.length - 1];
        
        return (
          <div key={sessionId} style={{ border: "1px solid #e2e8f0", marginBottom: "15px", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <div 
              onClick={() => setExpandedSession(expandedSession === sessionId ? null : sessionId)}
              style={{ 
                padding: "18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                background: activeTab === "whatsapp" ? "#f0fff4" : "#ffffff"
              }}
            >
              <div>
                <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "4px" }}>{sessionId}</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  Last active: {new Date(lastMsg.created_at).toLocaleDateString()} at {formatTime(lastMsg.created_at)}
                  {activeTab === "whatsapp" && msgs[0].phone_number && ` • +${msgs[0].phone_number}`}
                </div>
              </div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#007bff" }}>
                {expandedSession === sessionId ? "Collapse" : "Open Chat"}
              </div>
            </div>
            
            {expandedSession === sessionId && (
              <div style={{ padding: "20px", background: "#fff", borderTop: "1px solid #f1f5f9" }}>
                {msgs.map((m: any) => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: "15px" }}>
                    <div style={{ 
                      padding: "12px 16px", borderRadius: "18px", fontSize: "14px", lineHeight: "1.5",
                      backgroundColor: m.role === 'user' ? (activeTab === "whatsapp" ? "#dcf8c6" : "#007bff") : "#f1f5f9",
                      color: m.role === 'user' && activeTab === "website" ? "#fff" : "#1e293b",
                      maxWidth: "80%", boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                    }}>
                      {m.content}
                      <div style={{ 
                        fontSize: "10px", marginTop: "6px", textAlign: "right", opacity: 0.6,
                        color: m.role === 'user' && activeTab === "website" ? "#e0f2fe" : "#64748b"
                      }}>
                        {formatTime(m.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}