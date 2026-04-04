"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChatbotsPage() {
  const [bots, setBots] = useState<any[]>([]);
  const [chatbotLimit, setChatbotLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // 1. Load user's chatbots - Sorted by created_at so the list is stable
      const { data: botData } = await supabase
        .from("chatbots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      setBots(botData || []);

      // 2. Load subscription limit using the email as calendar_id
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("chatbot_limit")
        .eq("calendar_id", user.email)
        .single();

      if (subscription) {
        setChatbotLimit(subscription.chatbot_limit);
      }

      setLoading(false);
    };

    loadData();
  }, [router]);

  const createBot = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Logic: Only allow creation if they are currently under their plan limit
    // We count only "active" bots or total bots depending on your business rule.
    // Usually, you check total bots against the limit.
    if (bots.length >= chatbotLimit) {
      alert(`Limit reached: Your plan allows ${chatbotLimit} chatbots. Please upgrade.`);
      return;
    }

    const { data, error } = await supabase
      .from("chatbots")
      .insert({
        name: "New Chatbot",
        welcome_message: "Hello! How can I help?",
        model: "gpt-4o-mini",
        temperature: 0.7,
        user_id: user.id,
        active: true, // Explicitly set to true on creation
      })
      .select()
      .single();

    if (error) {
      alert("Error creating chatbot");
      return;
    }

    router.push(`/dashboard/chatbots/${data.id}`);
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <button
          onClick={createBot}
          style={{
            padding: "10px 20px",
            background: bots.length >= chatbotLimit ? "#6b7280" : "#2563eb",
            color: "white",
            borderRadius: 6,
            cursor: bots.length >= chatbotLimit ? "not-allowed" : "pointer",
            border: "none"
          }}
          disabled={bots.length >= chatbotLimit}
        >
          + Create Chatbot
        </button>

        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>
            Chatbots: {bots.length} / {chatbotLimit}
          </p>
          {bots.length > chatbotLimit && (
            <small style={{ color: "#ef4444" }}>Plan exceeded. Some bots are disabled.</small>
          )}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : bots.length === 0 ? (
        <p>No chatbots yet. Create your first one above!</p>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              onClick={() => router.push(`/dashboard/chatbots/${bot.id}`)}
              style={{
                padding: 20,
                borderRadius: 10,
                background: bot.active ? "#3e368d" : "#1f1d36", // Darker background if inactive
                color: "white",
                cursor: "pointer",
                border: bot.active ? "none" : "1px solid #ef4444",
                opacity: bot.active ? 1 : 0.7,
                position: "relative"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h3>{bot.name}</h3>
                <span style={{ 
                  fontSize: "12px", 
                  padding: "4px 8px", 
                  borderRadius: "4px", 
                  background: bot.active ? "#22c55e" : "#ef4444" 
                }}>
                  {bot.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p style={{ margin: "5px 0" }}>Model: {bot.model}</p>
              <p style={{ margin: "5px 0" }}>Temperature: {bot.temperature}</p>
              
              {!bot.active && (
                <p style={{ color: "#fca5a5", fontSize: "12px", marginTop: "10px" }}>
                  ⚠️ This bot is disabled because it exceeds your current plan limit.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}