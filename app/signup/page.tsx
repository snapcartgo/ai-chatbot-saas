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

  try {
    const res = await fetch("/api/referral", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: finalRef,
        userId,
        email: userEmail,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.log("Referral skipped:", data.error);
      return;
    }

    console.log("Referral applied");
    localStorage.removeItem("referral");
  } catch (err) {
    console.error("Referral error", err);
  }
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

      // 🚫 BLOCK if already logged in (extra safety)
const { data: currentUser } = await supabase.auth.getUser();

if (currentUser?.user) {
  console.log("User already logged in → skip referral");
  return;
}

      alert("Signup successful");
      router.push("/dashboard");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // only replace handleGoogleSignup function in your existing file
const handleGoogleSignup = async () => {
  const finalRef = referralCode || localStorage.getItem("referral");

  if (finalRef) {
    localStorage.setItem("referral", finalRef);
  }

  const redirectUrl = finalRef
    ? `${window.location.origin}/dashboard?ref=${encodeURIComponent(finalRef)}`
    : `${window.location.origin}/dashboard`;

  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
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
