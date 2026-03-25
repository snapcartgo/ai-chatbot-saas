"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // ✅ SAFE VERSION (NO useSearchParams)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refFromUrl = params.get("ref");
    const refFromStorage = localStorage.getItem("referral");

    if (refFromUrl) {
      setReferralCode(refFromUrl);
      localStorage.setItem("referral", refFromUrl);
    } else if (refFromStorage) {
      setReferralCode(refFromStorage);
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalRef =
        referralCode || localStorage.getItem("referral");

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      const user = data?.user;
      if (!user) throw new Error("User not created");

      // ✅ Save referral
      if (finalRef) {
        await supabase.from("referrals").insert([
          {
            partner_id: finalRef,
            referred_email: email.toLowerCase(),
            referred_user_id: user.id,
            status: "pending",
          },
        ]);

        localStorage.removeItem("referral");
      }

      alert("Signup successful 🚀");
      router.push("/dashboard");

    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="grid md:grid-cols-2 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl max-w-4xl w-full border border-gray-800">

        <div className="p-10 hidden md:flex flex-col justify-center bg-blue-600">
          <h2 className="text-3xl font-bold mb-6">AI Chatbot SaaS</h2>
          <p className="mb-6 opacity-90 text-lg">
            Automate your business leads and bookings with AI.
          </p>
        </div>

        <div className="p-10">
          <h1 className="text-2xl font-bold mb-2">Create your account</h1>

          {referralCode && (
            <div className="bg-blue-900/30 border border-blue-500/50 px-3 py-1.5 rounded-md mb-4">
              Referral Applied: {referralCode}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">

            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 p-3 rounded-lg font-bold"
            >
              {loading ? "Creating..." : "Start Free Trial"}
            </button>

          </form>

          <p className="text-gray-400 text-sm mt-6 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-400">
              Login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}