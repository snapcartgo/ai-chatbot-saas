"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PaymentSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [merchantKey, setMerchantKey] = useState("");
  const [merchantSalt, setMerchantSalt] = useState("");
  const [payuActive, setPayuActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 Load data
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
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setMerchantKey(data.payu_merchant_key || "");
        setMerchantSalt(data.payu_merchant_salt || "");
        setPayuActive(data.payu_active || false);
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
  .from("profiles")
  .upsert({
    id: user.id,
    payu_merchant_key: merchantKey,
    payu_merchant_salt: merchantSalt,
    payu_active: payuActive,
  });

if (error) {
  console.error("ERROR:", error);
  alert(error.message);
}

    alert("Saved successfully!");
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  return (
    <div style={{ padding: 30, maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>
        PayU Settings
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

      {/* Active Toggle */}
      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={payuActive}
            onChange={(e) => setPayuActive(e.target.checked)}
          />{" "}
          Enable PayU
        </label>
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