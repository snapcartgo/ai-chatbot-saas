"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChatbotsPage() {
  const [bots, setBots] = useState<any[]>([]);
  const [chatbotLimit, setChatbotLimit] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const loadBots = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Load user's chatbots
      const { data: botData } = await supabase
        .from("chatbots")
        .select("*")
        .eq("user_id", user.id);

      setBots(botData || []);

      // Load subscription limit
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

    loadBots();
  }, [router]);

  const createBot = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    // Check chatbot limit
    if (bots.length >= chatbotLimit) {
      alert("You have reached your chatbot limit. Please upgrade your plan.");
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
    <div>
      <button
        onClick={createBot}
        style={{
          padding: "10px 20px",
          background: "#2563eb",
          color: "white",
          borderRadius: 6,
          marginBottom: 30,
        }}
      >
        + Create Chatbot
      </button>

      <p>
        Chatbots used: {bots.length} / {chatbotLimit}
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : bots.length === 0 ? (
        <p>No chatbots yet.</p>
      ) : (
        bots.map((bot) => (
          <div
            key={bot.id}
            onClick={() =>
              router.push(`/dashboard/chatbots/${bot.id}`)
            }
            style={{
              padding: 20,
              marginBottom: 15,
              borderRadius: 10,
              background: "#3e368d",
              color: "white",
              cursor: "pointer",
            }}
          >
            <h3>{bot.name}</h3>
            <p>Model: {bot.model}</p>
            <p>Temperature: {bot.temperature}</p>
          </div>
        ))
      )}
    </div>
  );
}