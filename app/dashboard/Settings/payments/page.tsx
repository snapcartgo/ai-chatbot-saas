"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function PaymentSettings() {
  // Use the specific browser client creator
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [key, setKey] = useState("");
  const [salt, setSalt] = useState("");

  // 1. Load existing keys from Supabase when page opens
  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("payu_merchant_key, payu_merchant_salt")
          .eq("id", user.id)
          .single();
        
        if (data) {
          setKey(data.payu_merchant_key || "");
          setSalt(data.payu_merchant_salt || "");
        }
        if (error) console.error("Error fetching profile:", error);
      }
      setLoading(false);
    }
    getProfile();
  }, [supabase]);

  // 2. Save the keys to the profiles table
  const handleSave = async () => {
    setUpdating(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert("You must be logged in to save settings.");
      setUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        payu_merchant_key: key,
        payu_merchant_salt: salt,
      })
      .eq("id", user.id);

    if (error) {
      alert("Error saving settings: " + error.message);
    } else {
      alert("Payment settings updated successfully!");
    }
    
    setUpdating(false);
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="max-w-2xl p-8 bg-white rounded-lg shadow-sm border mt-10 ml-10">
      <h1 className="text-2xl font-bold mb-2">eCommerce Payment Settings</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Enter your PayU credentials below. These will be used for your customers' transactions.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700">PayU Merchant Key</label>
          <input
            type="text"
            className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your Merchant Key here"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700">PayU Merchant Salt</label>
          <input
            type="password"
            className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition"
            value={salt}
            onChange={(e) => setSalt(e.target.value)}
            placeholder="Paste your Merchant Salt here"
          />
        </div>

        <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
          <p className="text-xs text-blue-800 font-medium">
            <strong>Important:</strong> Set your PayU Webhook URL to:<br/>
            <code className="bg-white px-1 py-0.5 rounded border mt-1 inline-block">
              https://ai-chatbot-saas-five.vercel.app/api/payu/webhook
            </code>
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={updating}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
        >
          {updating ? "Saving Credentials..." : "Save Payment Details"}
        </button>
      </div>
    </div>
  );
}