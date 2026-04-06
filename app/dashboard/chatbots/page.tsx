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
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // ✅ Get session
    const { data: { session } } = await supabase.auth.getSession();

    console.log("SESSION:", session); // 👈 ADD THIS LINE

    if (!session) {
      router.push("/login");
      return;
    }

    const user = session.user;

    // ✅ Load chatbots
    const { data: botData, error: botError } = await supabase
      .from("chatbots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (botError) {
      console.error(botError);
    }

    setBots(botData || []);

    // ✅ Load subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("chatbot_limit")
      .eq("calendar_id", user.email)
      .single();

    if (subError) {
      console.error(subError);
    }

    if (subscription) {
      setChatbotLimit(subscription.chatbot_limit);
    }

    setLoading(false);
  };

  const createBot = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (bots.length >= chatbotLimit) {
      alert(`Limit reached: Your plan allows ${chatbotLimit} chatbots.`);
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
        active: true,
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
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 30 }}>
        
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

        <div>
          <p>
            Chatbots: {bots.length} / {chatbotLimit}
          </p>
        </div>

      </div>

      {loading ? (
        <p>Loading...</p>
      ) : bots.length === 0 ? (
        <p>No chatbots yet</p>
      ) : (
        <div style={{ display: "grid", gap: "15px" }}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              onClick={() => router.push(`/dashboard/chatbots/${bot.id}`)}
              style={{
                padding: 20,
                borderRadius: 10,
                background: bot.active ? "#3e368d" : "#1f1d36",
                color: "white",
                cursor: "pointer"
              }}
            >
              <h3>{bot.name}</h3>
              <p>Model: {bot.model}</p>
              <p>Temperature: {bot.temperature}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}