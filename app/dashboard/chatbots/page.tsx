"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Types
type BotRow = {
  id: string;
  name: string;
  model: string;
  temperature: number;
  active: boolean;
  category?: string | null;
  workflow_type?: string | null;
};

type WhatsAppConfigRow = {
  id: string;
  phone_number: string | null;
  automation_enabled: boolean | null;
  default_prompt: string | null;
};

type WhatsAppSubscription = {
  status: string;
  plan: string;
  expires_at: string | null;
};

export default function ChatbotsPage() {
  const [bots, setBots] = useState<BotRow[]>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppConfigRow | null>(null);
  const [whatsappSub, setWhatsappSub] = useState<WhatsAppSubscription | null>(null);
  const [chatbotLimit, setChatbotLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const user = session.user;

    // 1. Load Website Chatbots
    const { data: botData } = await supabase
      .from("chatbots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const filteredBots = (botData || []).filter(
      (bot) => bot.workflow_type !== "whatsapp_only"
    );
    setBots(filteredBots as BotRow[]);

    // 2. Load WhatsApp Configuration (from whatsapp_configs)
    const { data: whatsappData } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number, automation_enabled, default_prompt")
      .eq("user_id", user.id)
      .maybeSingle();
    setWhatsappConfig(whatsappData as WhatsAppConfigRow | null);

    // 3. Load WhatsApp Subscription (from whatsapp_subscriptions)
    const { data: subData } = await supabase
      .from("whatsapp_subscriptions")
      .select("status, plan, expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setWhatsappSub(subData as WhatsAppSubscription | null);

    // 4. Load Global Subscription Limits
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

  // Logic to check if the user has an active, paid monthly plan
  const isWhatsAppActive = 
    whatsappSub?.status === 'active' && 
    whatsappSub?.expires_at && 
    new Date(whatsappSub.expires_at) > new Date();

  const createBot = async () => {
    const { data: { user } } = await supabase.auth.getUser();
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
      workflow_type: null,
    });

    if (!error) await loadData();
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
            border: "none",
          }}
          disabled={bots.length >= chatbotLimit}
        >
          + Create Chatbot
        </button>

        <div>
          <p>Website Chatbots: {bots.length} / {chatbotLimit || 2}</p>
        </div>
      </div>

      {/* WhatsApp Channel Card */}
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
          
          <p>
            Status: 
            <span style={{ 
              marginLeft: "8px", 
              fontWeight: "bold", 
              color: isWhatsAppActive ? "#10b981" : "#ef4444" 
            }}>
              {isWhatsAppActive ? "Active" : "Inactive"}
            </span>
          </p>

          <p>Number: {whatsappConfig?.phone_number || "Not set"}</p>
          
          {isWhatsAppActive && whatsappSub?.expires_at && (
            <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
              Plan expires on: {new Date(whatsappSub.expires_at).toLocaleDateString()}
            </p>
          )}

          <div style={{ marginTop: 12 }}>
            {isWhatsAppActive ? (
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
            ) : (
              <Link
                href="/dashboard/Billing"
                style={{
                  display: "inline-block",
                  padding: "8px 14px",
                  background: "#f59e0b",
                  color: "white",
                  borderRadius: 6,
                  textDecoration: "none",
                }}
              >
                Buy WhatsApp Bot
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Website Chatbots List */}
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