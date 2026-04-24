"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";// Adjust based on your auth setup

export default function WhatsAppSettings() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    twilio_sid: "",
    twilio_auth_token: "",
    phone_number: "",
    chatbot_id: ""
  });

  // 1. Load existing settings on page load
  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase.from("whatsapp_configs").select("*").single();
      if (data) setConfig(data);
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    // 2. Upsert the data into Supabase
    const { error } = await supabase.from("whatsapp_configs").upsert({
      ...config,
      // Ensure the user_id is set to the current logged-in user
    });
    
    if (!error) alert("Settings saved!");
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-2xl bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">WhatsApp Integration</h1>
      <p className="text-gray-500 mb-6">Connect your Twilio account to enable WhatsApp automation.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Twilio Account SID</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded" 
            placeholder="AC..." 
            value={config.twilio_sid}
            onChange={(e) => setConfig({...config, twilio_sid: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Twilio Auth Token</label>
          <input 
            type="password" 
            className="w-full p-2 border rounded" 
            value={config.twilio_auth_token}
            onChange={(e) => setConfig({...config, twilio_auth_token: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">WhatsApp Number</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded" 
            placeholder="whatsapp:+1..." 
            value={config.phone_number}
            onChange={(e) => setConfig({...config, phone_number: e.target.value})}
          />
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Instructional Sidebar/Section */}
      <div className="mt-10 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-bold text-blue-800">Setup Instructions</h3>
        <ol className="list-decimal ml-5 mt-2 text-sm text-blue-700 space-y-2">
          <li>Get your credentials from the Twilio Console.</li>
          <li>Set your Webhook URL in Twilio to: <br/> 
            <code className="bg-white p-1 rounded font-mono">https://your-domain.com/api/whatsapp/webhook</code>
          </li>
        </ol>
      </div>
    </div>
  );
}