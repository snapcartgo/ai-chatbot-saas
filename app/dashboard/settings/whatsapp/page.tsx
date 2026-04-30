"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type WhatsAppConfigState = {
  twilio_sid: string;
  twilio_auth_token: string;
  phone_number: string;
  category: "booking" | "ecommerce";
};

export default function WhatsAppSettings() {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigState>({
    twilio_sid: "",
    twilio_auth_token: "",
    phone_number: "",
    category: "booking",
  });

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: configData, error } = await supabase
        .from("whatsapp_configs")
        .select("twilio_sid, twilio_auth_token, phone_number, category")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Failed to load WhatsApp settings:", error);
        return;
      }

      if (configData) {
        setConfig({
          twilio_sid: configData.twilio_sid ?? "",
          twilio_auth_token: configData.twilio_auth_token ?? "",
          phone_number: configData.phone_number ?? "",
          category:
            configData.category === "ecommerce" ? "ecommerce" : "booking",
        });
      }
    }

    loadSettings();
  }, [supabase]);

  const handleSave = async () => {
    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        alert("User session not found. Please log in again.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/whatsapp/save-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("WhatsApp save-config error:", data);
        alert(data.error || "Failed to save WhatsApp settings.");
        setLoading(false);
        return;
      }

      alert("WhatsApp settings saved successfully!");
    } catch (error) {
      console.error("Unexpected WhatsApp save error:", error);
      alert("Something went wrong while saving WhatsApp settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">WhatsApp Integration</h1>
      <p className="text-gray-500 mb-6">
        Configure your single WhatsApp automation channel here.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Twilio Account SID</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="AC..."
            value={config.twilio_sid}
            onChange={(e) =>
              setConfig({ ...config, twilio_sid: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Twilio Auth Token</label>
          <input
            type="password"
            className="w-full p-2 border rounded"
            value={config.twilio_auth_token}
            onChange={(e) =>
              setConfig({ ...config, twilio_auth_token: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium">WhatsApp Number</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            placeholder="+14155238886"
            value={config.phone_number}
            onChange={(e) =>
              setConfig({ ...config, phone_number: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Chatbot Category</label>
          <select
            className="w-full p-2 border rounded"
            value={config.category}
            onChange={(e) =>
              setConfig({
                ...config,
                category:
                  e.target.value === "ecommerce" ? "ecommerce" : "booking",
              })
            }
          >
            <option value="booking">Booking</option>
            <option value="ecommerce">Ecommerce</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            A single WhatsApp chatbot will be created automatically for this
            user if one does not already exist.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {loading ? "Saving..." : "Update WhatsApp Settings"}
        </button>
      </div>
    </div>
  );
}
