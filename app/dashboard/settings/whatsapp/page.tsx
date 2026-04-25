"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type ChatbotOption = {
  id: string;
  name: string;
};

export default function WhatsAppSettings() {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [chatbotsLoading, setChatbotsLoading] = useState(true);
  const [chatbots, setChatbots] = useState<ChatbotOption[]>([]);
  const [config, setConfig] = useState({
    twilio_sid: "",
    twilio_auth_token: "",
    phone_number: "",
    chatbot_id: "",
  });

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const [{ data: configData }, { data: botData }] = await Promise.all([
        supabase
          .from("whatsapp_configs")
          .select("twilio_sid, twilio_auth_token, phone_number, chatbot_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("chatbots").select("id, name").eq("user_id", user.id).order("created_at", { ascending: true }),
      ]);

      if (configData) {
        setConfig({
          twilio_sid: configData.twilio_sid ?? "",
          twilio_auth_token: configData.twilio_auth_token ?? "",
          phone_number: configData.phone_number ?? "",
          chatbot_id: configData.chatbot_id ?? "",
        });
      }

      setChatbots((botData || []) as ChatbotOption[]);
      setChatbotsLoading(false);
    }

    loadSettings();
  }, [supabase]);

  const handleSave = async () => {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("User session not found. Please log in again.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("whatsapp_configs").upsert(
      {
        user_id: user.id,
        twilio_sid: config.twilio_sid,
        twilio_auth_token: config.twilio_auth_token,
        phone_number: config.phone_number,
        chatbot_id: config.chatbot_id || null,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Save Error:", error.message);
      alert("Save failed: " + error.message);
    } else {
      alert("Settings saved successfully!");
    }

    setLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">WhatsApp Integration</h1>
      <p className="text-gray-500 mb-6">
        Connect your Twilio account and link a chatbot so WhatsApp can use the same knowledge base.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Twilio Account SID</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="AC..."
            value={config.twilio_sid}
            onChange={(e) => setConfig({ ...config, twilio_sid: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Twilio Auth Token</label>
          <input
            type="password"
            className="w-full p-2 border rounded"
            value={config.twilio_auth_token}
            onChange={(e) => setConfig({ ...config, twilio_auth_token: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">WhatsApp Number</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="whatsapp:+1..."
            value={config.phone_number}
            onChange={(e) => setConfig({ ...config, phone_number: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Linked Chatbot</label>
          <select
            className="w-full p-2 border rounded"
            value={config.chatbot_id}
            onChange={(e) => setConfig({ ...config, chatbot_id: e.target.value })}
            disabled={chatbotsLoading}
          >
            <option value="">Select a chatbot</option>
            {chatbots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            This chatbot’s knowledge base will power WhatsApp replies.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="mt-10 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-bold text-blue-800">Setup Instructions</h3>
        <ol className="list-decimal ml-5 mt-2 text-sm text-blue-700 space-y-2">
          <li>Get your credentials from the Twilio Console.</li>
          <li>
            Set your Webhook URL in Twilio to:
            <br />
            <code className="bg-white p-1 rounded font-mono">
              https://your-domain.com/api/whatsapp/webhook
            </code>
          </li>
        </ol>
      </div>
    </div>
  );
}
