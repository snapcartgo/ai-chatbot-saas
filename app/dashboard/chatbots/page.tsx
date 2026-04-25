"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type BotRow = {
  id: string;
  name: string;
  model: string;
  temperature: number;
  active: boolean;
  category?: string | null;
};

type WhatsAppConfigRow = {
  id: string;
  phone_number: string | null;
  automation_enabled: boolean | null;
  default_prompt: string | null;
};

export default function ChatbotsPage() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfigRow | null>(null);
  const [chatbotLimit, setChatbotLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const user = session.user;

    const { data: botData, error: botError } = await supabase
      .from("chatbots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (botError) {
      console.error("Load bots error:", botError);
    }

    setBots((botData || []) as BotRow[]);

    const { data: whatsappData, error: whatsappError } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number, automation_enabled, default_prompt")
      .eq("user_id", user.id)
      .maybeSingle();

    if (whatsappError) {
      console.error("Load WhatsApp config error:", whatsappError);
    }

    setWhatsappConfig((whatsappData || null) as WhatsAppConfigRow | null);

    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("chatbot_limit")
      .eq("calendar_id", user.email)
      .single();

    if (subError) {
      console.error("Subscription error:", subError);
    }

    if (subscription) {
      setChatbotLimit(subscription.chatbot_limit);
    }

    setLoading(false);
  };

  const createBot = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const limit = chatbotLimit || 2;

    if (bots.length >= limit) {
      alert(`Limit reached: Your plan allows ${limit} chatbots.`);
      return;
    }

    const { error } = await supabase.from("chatbots").insert({
      name: "New Chatbot",
      welcome_message: "Hello! How can I help?",
      model: "gpt-4o-mini",
      temperature: 0.7,
      user_id: user.id,
      active: true,
      category: "booking",
    });

    if (error) {
      console.error("Create bot error:", error);
      alert(error.message || "Error creating chatbot");
      return;
    }

    const { data: latestBot, error: latestError } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      console.error("Latest bot lookup error:", latestError);
    }

    if (latestBot?.id) {
      router.push(`/dashboard/chatbots/${latestBot.id}`);
      return;
    }

    await loadData();
  };

  const whatsappEnabled = !!whatsappConfig?.automation_enabled;

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
            border: "none",
          }}
          disabled={bots.length >= chatbotLimit}
        >
          + Create Chatbot
        </button>

        <div>
          <p>
            Website Chatbots: {bots.length} / {chatbotLimit || 2}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "16px", marginBottom: "24px" }}>
        <div
          style={{
            padding: 20,
            borderRadius: 10,
            background: "#111827",
            color: "white",
          }}
        >
          <h3 style={{ marginBottom: 8 }}>WhatsApp Channel</h3>
          <p>Status: {whatsappEnabled ? "Enabled" : "Not configured"}</p>
          <p>Number: {whatsappConfig?.phone_number || "Not set"}</p>
          <div style={{ marginTop: 12 }}>
            <Link
              href="/dashboard/settings/whatsapp"
              style={{
                display: "inline-block",
                padding: "8px 14px",
                background: "#2563eb",
                color: "white",
                borderRadius: 6,
                textDecoration: "none",
              }}
            >
              Configure WhatsApp
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : bots.length === 0 ? (
        <p>No website chatbots yet</p>
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
                cursor: "pointer",
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
