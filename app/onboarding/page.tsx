"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Onboarding() {
  const [country, setCountry] = useState("India");
  const [business, setBusiness] = useState("Dentist");
  const router = useRouter();

  const handleContinue = async () => {
  // ✅ get logged-in user
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    router.push("/login");
    return;
  }

  // ✅ save onboarding data
  await supabase.from("users").upsert({
    id: user.id,
    country: country,
    business_type: business,
    onboarded: true,
  });

  // ✅ go to dashboard
  router.push("/dashboard");
};
  return (
    <div style={{ padding: 40 }}>
      <h1>Welcome 👋</h1>
      <p>Let’s set up your AI chatbot</p>

      <div style={{ marginTop: 20 }}>
        <label>Business Type</label><br />
        <select value={business} onChange={(e) => setBusiness(e.target.value)}>
          <option>Dentist</option>
          <option>Real Estate</option>
          <option>Agency</option>
          <option>Other</option>
        </select>
      </div>

      <div style={{ marginTop: 20 }}>
        <label>Country</label><br />
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option>India</option>
          <option>Other</option>
        </select>
      </div>

      <button
        onClick={handleContinue}
        style={{ marginTop: 20, padding: 10, background: "blue", color: "white" }}
      >
        Continue
      </button>
    </div>
  );
}