"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

// Initialize this OUTSIDE the component function
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PaymentSettings() {
  // ... rest of your code
  const [key, setKey] = useState("");
  const [salt, setSalt] = useState("");
  const [updating, setUpdating] = useState(false);

  const handleSave = async () => {
  setUpdating(true);
  
  // getSession is the most reliable way to check the current browser state
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    alert("Session not found. Please clear your browser cookies and log in again.");
    setUpdating(false);
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      payu_merchant_key: key,
      payu_merchant_salt: salt,
    })
    .eq("id", session.user.id);

  if (error) {
    alert("Database Error: " + error.message);
  } else {
    alert("Success! Your PayU credentials have been saved.");
  }
  setUpdating(false);
};

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Payment Settings</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">PayU Merchant Key</label>
          <input 
            className="w-full p-2 border rounded text-black" 
            value={key} 
            onChange={(e) => setKey(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PayU Merchant Salt (32-bit)</label>
          <input 
            className="w-full p-2 border rounded text-black" 
            type="password"
            value={salt} 
            onChange={(e) => setSalt(e.target.value)} 
          />
        </div>
        <button 
          onClick={handleSave}
          disabled={updating}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {updating ? "Saving..." : "Save Payment Details"}
        </button>
      </div>
    </div>
  );
}