"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    const refFromStorage = localStorage.getItem("referral");
    if (refFromUrl) {
      setReferralCode(refFromUrl);
      localStorage.setItem("referral", refFromUrl);
    } else if (refFromStorage) {
      setReferralCode(refFromStorage);
    }
  }, [searchParams]);

  
  const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const finalRef =
      referralCode || localStorage.getItem("referral");

    console.log("Referral Code:", finalRef);

    // 1. Signup user
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error("Signup Error:", authError.message);
      throw authError;
    }

    const user = data?.user;

    if (!user) {
      throw new Error("User not created");
    }

    console.log("User created:", user.id);

    // ✅ 2. INSERT REFERRAL WITH USER ID (IMPORTANT FIX)
    if (finalRef) {
      const { error: refError } = await supabase
        .from("referrals")
        .insert([
          {
            partner_id: finalRef,
            referred_email: email.toLowerCase(),
            referred_user_id: user.id, // 🔥 THIS IS THE MAIN FIX
            status: "pending",
          },
        ]);

      if (refError) {
        console.error("Referral Insert Error:", refError.message);
      } else {
        console.log("Referral saved successfully ✅");
        localStorage.removeItem("referral");
      }
    }

    alert("Signup successful 🚀");
    router.push("/dashboard");

  } catch (err: any) {
    console.error("FULL ERROR:", err);
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
          <p className="mb-6 opacity-90 text-lg">Automate your business leads and bookings with AI.</p>
        </div>

        <div className="p-10">
          <h1 className="text-2xl font-bold mb-2">Create your account</h1>
          {referralCode && (
            <div className="bg-blue-900/30 border border-blue-500/50 px-3 py-1.5 rounded-md mb-4 flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-blue-400">Referral Applied:</span>
              <span className="text-sm font-mono text-blue-200">{referralCode}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs text-gray-400 ml-1">Email Address</label>
                <input
                type="email"
                placeholder="name@company.com"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
            </div>
            <div className="space-y-1 relative">
              <label className="text-xs text-gray-400 ml-1">Password</label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-bold transition-all disabled:opacity-50 mt-4 shadow-lg"
            >
              {loading ? "Creating Account..." : "Start Free Trial"}
            </button>
          </form>
          <p className="text-gray-400 text-sm mt-8 text-center">
            Already have an account? <Link href="/login" className="text-blue-400 hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}