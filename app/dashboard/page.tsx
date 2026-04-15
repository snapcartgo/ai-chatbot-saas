"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PaymentSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);

  // PayU
  const [merchantKey, setMerchantKey] = useState("");
  const [merchantSalt, setMerchantSalt] = useState("");
  const [payuActive, setPayuActive] = useState(false);

  // PayPal
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");
  const [paypalActive, setPaypalActive] = useState(false);

  // 🔹 Manual Payment (UPI/Bank)
  const [upiVpa, setUpiVpa] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState(""); // ✅ New WhatsApp State
  const [bankName, setBankName] = useState("");
  const [bankAccNo, setBankAccNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upiActive, setUpiActive] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      // 1. Load Profile Data (Includes PayU, PayPal, and now WhatsApp)
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setMerchantKey(profile.payu_merchant_key || "");
        setMerchantSalt(profile.payu_merchant_salt || "");
        setPayuActive(profile.payu_is_active || false);
        setPaypalClientId(profile.paypal_client_id || "");
        setPaypalSecret(profile.paypal_secret || "");
        setPaypalActive(profile.paypal_is_active || false);
        
        // Load manual details from profile
        setUpiVpa(profile.upi_vpa || "");
        setMerchantName(profile.merchant_name || "");
        setWhatsappNumber(profile.whatsapp_number || ""); // ✅ Load WhatsApp
        setBankName(profile.bank_name || "");
        setBankAccNo(profile.bank_account_number || "");
        setBankIfsc(profile.bank_ifsc || "");
        setUpiActive(profile.is_manual_enabled || false);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        // PayU & PayPal
        payu_merchant_key: merchantKey,
        payu_merchant_salt: merchantSalt,
        payu_is_active: payuActive,
        paypal_client_id: paypalClientId,
        paypal_secret: paypalSecret,
        paypal_is_active: paypalActive,
        
        // UPI, Bank & WhatsApp
        merchant_name: merchantName,
        upi_vpa: upiVpa,
        whatsapp_number: whatsappNumber, // ✅ Save WhatsApp
        bank_name: bankName,
        bank_account_number: bankAccNo,
        bank_ifsc: bankIfsc,
        is_manual_enabled: upiActive,
      });

    setSaving(false);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      alert("All Payment settings updated successfully!");
    }
  };

  if (loading) return <div style={{ padding: 50 }}>Loading settings...</div>;

  return (
    <div style={{ padding: "30px 50px", maxWidth: 800, paddingBottom: 100 }}>
      
      {/* PayU Section */}
      <h2 style={sectionTitle}>PayU Settings</h2>
      <div style={gridRow}>
        <div style={flex1}>
          <label style={labelStyle}>Merchant Key</label>
          <input type="text" value={merchantKey} onChange={(e) => setMerchantKey(e.target.value)} placeholder="Enter Key" style={inputStyle} />
        </div>
        <div style={flex1}>
          <label style={labelStyle}>Merchant Salt</label>
          <input type="text" value={merchantSalt} onChange={(e) => setMerchantSalt(e.target.value)} placeholder="Enter Salt" style={inputStyle} />
        </div>
      </div>
      <label style={checkboxContainer}>
        <input type="checkbox" checked={payuActive} onChange={(e) => setPayuActive(e.target.checked)} /> Enable PayU
      </label>

      <hr style={divider} />

      {/* PayPal Section */}
      <h2 style={sectionTitle}>PayPal Settings</h2>
      <div style={gridRow}>
        <div style={flex1}>
          <label style={labelStyle}>Client ID</label>
          <input type="text" value={paypalClientId} onChange={(e) => setPaypalClientId(e.target.value)} placeholder="Enter Client ID" style={inputStyle} />
        </div>
        <div style={flex1}>
          <label style={labelStyle}>Client Secret</label>
          <input type="text" value={paypalSecret} onChange={(e) => setPaypalSecret(e.target.value)} placeholder="Enter Secret" style={inputStyle} />
        </div>
      </div>
      <label style={checkboxContainer}>
        <input type="checkbox" checked={paypalActive} onChange={(e) => setPaypalActive(e.target.checked)} /> Enable PayPal
      </label>

      <hr style={divider} />

      {/* UPI & Bank Section */}
      <h2 style={sectionTitle}>UPI & Bank Transfer (Fallback)</h2>
      <p style={{ color: "#666", fontSize: 14, marginBottom: 15 }}>
        These details will be shown to customers for manual payment and verification.
      </p>
      
      <div style={gridRow}>
        <div style={flex1}>
          <label style={labelStyle}>UPI VPA ID</label>
          <input type="text" value={upiVpa} onChange={(e) => setUpiVpa(e.target.value)} placeholder="e.g. name@upi" style={inputStyle} />
        </div>
        <div style={flex1}>
          <label style={labelStyle}>Merchant Name</label>
          <input type="text" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Business Name" style={inputStyle} />
        </div>
      </div>

      {/* 🔹 NEW: WhatsApp Field ✅ */}
      <div style={{ ...gridRow, marginTop: 15 }}>
        <div style={flex1}>
          <label style={labelStyle}>Business WhatsApp Number (With Country Code)</label>
          <input 
            type="text" 
            value={whatsappNumber} 
            onChange={(e) => setWhatsappNumber(e.target.value)} 
            placeholder="e.g. 919876543210" 
            style={inputStyle} 
          />
          <small style={{ color: "#888" }}>Used for receiving payment screenshots.</small>
        </div>
      </div>

      <div style={{ ...gridRow, marginTop: 15 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Bank Name</label>
          <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" style={inputStyle} />
        </div>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Account Number</label>
          <input type="text" value={bankAccNo} onChange={(e) => setBankAccNo(e.target.value)} placeholder="Account No" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>IFSC Code</label>
          <input type="text" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="IFSC" style={inputStyle} />
        </div>
      </div>

      <label style={checkboxContainer}>
        <input type="checkbox" checked={upiActive} onChange={(e) => setUpiActive(e.target.checked)} /> Enable Manual Fallback
      </label>

      <div style={{ marginTop: 40 }}>
        <button onClick={handleSave} disabled={saving} style={btnStyle}>
          {saving ? "Saving Changes..." : "Save All Settings"}
        </button>
      </div>
    </div>
  );
}

// Styles
const sectionTitle = { fontSize: 20, fontWeight: "600", marginBottom: 15, color: "#111" };
const labelStyle = { display: "block", fontSize: 13, fontWeight: "500", color: "#444", marginBottom: 5 };
const inputStyle = { width: "100%", padding: "10px", borderRadius: 6, border: "1px solid #ddd", fontSize: 14 };
const gridRow = { display: "flex", gap: 20, marginBottom: 10 };
const flex1 = { flex: 1 };
const checkboxContainer = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", marginTop: 10 };
const divider = { border: "none", borderTop: "1px solid #eee", margin: "30px 0" };
const btnStyle = { padding: "12px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "600" };