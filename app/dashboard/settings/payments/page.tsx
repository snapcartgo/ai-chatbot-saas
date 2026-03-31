"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PaymentSettingsPage() {
  const [user, setUser] = useState<any>(null);

  // PayU
  const [merchantKey, setMerchantKey] = useState("");
  const [merchantSalt, setMerchantSalt] = useState("");
  const [payuActive, setPayuActive] = useState(false);

  // PayPal ✅ NEW
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");
  const [paypalActive, setPaypalActive] = useState(false);

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
        // PayU
        setMerchantKey(data.payu_merchant_key || "");
        setMerchantSalt(data.payu_merchant_salt || "");
        setPayuActive(data.payu_is_active || false);

        // PayPal ✅
        setPaypalClientId(data.paypal_client_id || "");
        setPaypalSecret(data.paypal_secret || "");
        setPaypalActive(data.paypal_is_active || false);
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

        // PayU
        payu_merchant_key: merchantKey,
        payu_merchant_salt: merchantSalt,
        payu_is_active: payuActive,

        // PayPal ✅
        paypal_client_id: paypalClientId,
        paypal_secret: paypalSecret,
        paypal_is_active: paypalActive,
      });

    setSaving(false);

    if (error) {
      console.error("ERROR:", error);
      alert(error.message);
      return;
    }

    alert("Saved successfully!");
  };

  if (loading) {
    return <p style={{ padding: 20 }}>Loading...</p>;
  }

  return (
    <div style={{ padding: 30, maxWidth: 600 }}>
      
      {/* ---------------- PayU ---------------- */}
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>
        PayU Settings
      </h1>

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

      <div style={{ marginBottom: 30 }}>
        <label>
          <input
            type="checkbox"
            checked={payuActive}
            onChange={(e) => setPayuActive(e.target.checked)}
          />{" "}
          Enable PayU
        </label>
      </div>

      {/* ---------------- PayPal ---------------- */}
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>
        PayPal Settings
      </h1>

      <div style={{ marginBottom: 20 }}>
        <label>PayPal Client ID</label>
        <input
          type="text"
          value={paypalClientId}
          onChange={(e) => setPaypalClientId(e.target.value)}
          placeholder="Enter PayPal Client ID"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>PayPal Secret</label>
        <input
          type="text"
          value={paypalSecret}
          onChange={(e) => setPaypalSecret(e.target.value)}
          placeholder="Enter PayPal Secret"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>
          <input
            type="checkbox"
            checked={paypalActive}
            onChange={(e) => setPaypalActive(e.target.checked)}
          />{" "}
          Enable PayPal
        </label>
      </div>

      {/* Save Button */}
      <button onClick={handleSave} disabled={saving} style={btnStyle}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// Styles
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