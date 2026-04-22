"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Onboarding() {
  const [country, setCountry] = useState("India");
  const [business, setBusiness] = useState("Dentist");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // ✅ Auto-set business from demo
  useEffect(() => {
    const demo = localStorage.getItem("demo_type");

    if (demo) {
      if (demo === "real-estate") setBusiness("Real Estate");
      if (demo === "dentist") setBusiness("Dentist");
      if (demo === "salon") setBusiness("Salon");
    }
  }, []);

  // ✅ Handle Continue
  const handleContinue = async () => {
    setLoading(true);

    try {
      // ✅ get logged-in user
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        router.push("/login");
        return;
      }

      const user = data.user;

      // ✅ save onboarding data
      const { error } = await supabase.from("users").upsert({
        id: user.id,
        country: country,
        business_type: business,
        onboarded: true,
      });

      if (error) throw error;

      // ✅ clear demo (optional but clean)
      localStorage.removeItem("demo_type");

      // ✅ go to dashboard
      router.push("/dashboard");

    } catch (err: any) {
      alert(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="bg-gray-900 p-8 rounded-xl w-full max-w-md shadow-lg">

        <h1 className="text-2xl font-bold mb-2">
          Welcome 👋
        </h1>

        <p className="text-gray-400 mb-6">
          Let’s set up your AI chatbot
        </p>

        {/* BUSINESS */}
        <div className="mb-4">
          <label className="block mb-2 text-sm">Business Type</label>
          <select
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            className="w-full p-3 bg-gray-800 rounded"
          >
            <option>Dentist</option>
            <option>Real Estate</option>
            <option>Salon</option>
            <option>Agency</option>
            <option>Other</option>
          </select>
        </div>

        {/* COUNTRY */}
        <div className="mb-6">
          <label className="block mb-2 text-sm">Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full p-3 bg-gray-800 rounded"
          >
            <option>India</option>
            <option>Other</option>
          </select>
        </div>

        {/* BUTTON */}
        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full bg-blue-600 p-3 rounded font-bold hover:bg-blue-700 transition"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </div>
    </main>
  );
}