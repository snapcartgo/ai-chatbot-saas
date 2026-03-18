"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PaymentSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [merchantKey, setMerchantKey] = useState("");
  const [merchantSalt, setMerchantSalt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 Load existing data
  useEffect(() => {
    const loadData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUser(user);

      const { data } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setMerchantKey(data.merchant_key || "");
        setMerchantSalt(data.merchant_salt || "");
      }

      setLoading(false);
    };

    loadData();
  }, []);

  // 🔹 Save
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    const { error } = await supabase
      .from("payment_settings")
      .upsert({
        user_id: user.id,
        merchant_key: merchantKey,
        merchant_salt: merchantSalt,
      });

    setSaving(false);

    if (error) {
      alert("Error saving settings");
      return;
    }

    alert("Saved successfully!");
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  return (
    <div style={{ padding: 30, maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>
        Payment Settings (PayU)
      </h1>

      {/* Merchant Key */}
      <div style={{ marginBottom: 20 }}>
        <label>Merchant Key</label>
        <input
          type="text"
          value={merchantKey}
          onChange={(e) => setMerchantKey(e.target.value)}
          placeholder="Enter PayU Merchant Key"
          style={inputStyle}
        />
      </div>

      {/* Merchant Salt */}
      <div style={{ marginBottom: 20 }}>
        <label>Merchant Salt</label>
        <input
          type="text"
          value={merchantSalt}
          onChange={(e) => setMerchantSalt(e.target.value)}
          placeholder="Enter PayU Merchant Salt"
          style={inputStyle}
        />
      </div>

      <button onClick={handleSave} disabled={saving} style={btnStyle}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  marginTop: 5,
  borderRadius: 6,
  border: "1px solid #ccc",
};

const btnStyle = {
  padding: "10px 20px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
};