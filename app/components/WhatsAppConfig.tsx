"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function WhatsAppSetup({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const saveConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase.from("whatsapp_configs").upsert({
      user_id: userId,
      whatsapp_phone_id: formData.get("phone_id"),
      whatsapp_access_token: formData.get("token"),
      whatsapp_verify_token: "me_ai_agency_verify", 
    }, { onConflict: 'user_id' }); // This automates the update if it already exists

    setLoading(false);
    if (error) setStatus("Error: " + error.message);
    else setStatus("✅ WhatsApp Config Automated!");
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <h2 className="text-xl font-bold mb-4">Automate WhatsApp Setup</h2>
      <form onSubmit={saveConfig} className="space-y-4">
        <input name="phone_id" placeholder="Meta Phone ID" className="w-full border p-3 rounded-lg" required />
        <input name="token" type="password" placeholder="Permanent Access Token" className="w-full border p-3 rounded-lg" required />
        <button disabled={loading} className="w-full bg-black text-white p-3 rounded-lg font-bold">
          {loading ? "Saving..." : "Save & Automate"}
        </button>
        {status && <p className="text-sm font-medium mt-2">{status}</p>}
      </form>
    </div>
  );
}

