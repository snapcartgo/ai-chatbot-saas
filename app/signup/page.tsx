"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

  const attachReferral = async (userId: string, userEmail: string) => {
    const finalRef = referralCode || localStorage.getItem("referral");
    if (!finalRef) return;

    // map referral code -> partner UUID
    const { data: partner } = await supabase
      .from("partners")
      .select("id, referral_code")
      .eq("referral_code", finalRef)
      .maybeSingle();

    if (!partner?.id) return;

    // upsert-like behavior (manual because onConflict may differ)
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("referrals").insert([
        {
          partner_id: partner.id, // UUID (as text column)
          source_referral_code: partner.referral_code,
          referred_email: userEmail.toLowerCase(),
          referred_user_id: userId,
          status: "pending",
          payment_status: "pending",
        },
      ]);
    }

    localStorage.removeItem("referral");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const userId = data.user?.id;
      if (userId) {
        await attachReferral(userId, email);
      }

      alert("Signup successful");
      router.push("/dashboard");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    const finalRef = referralCode || localStorage.getItem("referral");
    if (finalRef) localStorage.setItem("referral", finalRef);

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="grid md:grid-cols-2 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl max-w-4xl w-full border border-gray-800">
        <div className="p-10 hidden md:flex flex-col justify-center bg-blue-600">
          <h2 className="text-3xl font-bold mb-6">AI Chatbot SaaS</h2>
          <p className="mb-6 opacity-90 text-lg">Automate your business with AI.</p>
        </div>

        <div className="p-10">
          <h1 className="text-2xl font-bold mb-2">Create your account</h1>

          {referralCode && (
            <div className="bg-blue-900/30 border border-blue-500/50 px-3 py-1.5 rounded-md mb-4">
              Referral Applied: {referralCode}
            </div>
          )}

          <button
            onClick={handleGoogleSignup}
            className="w-full bg-white text-black p-3 rounded-lg font-semibold mb-4"
          >
            Continue with Google
          </button>

          <div className="text-center text-gray-400 text-sm mb-4">OR</div>

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
              type="password"
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
