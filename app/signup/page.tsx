"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [demoType, setDemoType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  // ✅ Handle referral + demo tracking
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

    const demo = localStorage.getItem("demo_type");
    if (demo) {
      setDemoType(demo);
    }
  }, []);

  // ✅ Email Signup (Corrected for Referral/Client Role)
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "client", // 🔥 Mark as client, not partner
            referred_by: referralCode, // 🔥 Link to partner
            demo_type: demoType,
          },
        },
      });

      if (error) throw error;

      alert("Signup successful 🎉");
      router.push("/redirect"); 
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Google Signup (Corrected for Referral/Client Role)
  // ✅ Google Signup (Corrected for Auth Helpers)
  const handleGoogleSignup = async () => {
    try {
      const redirectUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000/redirect"
          : `${window.location.origin}/redirect`;

      // Inside handleGoogleSignup
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: redirectUrl,
    queryParams: {
      role: "client",
      referred_by: referralCode || "", // Ensure this is current
    },
  },
});
    } catch (err: any) {
      alert("Google signup failed");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="bg-gray-900 p-10 rounded-xl w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold mb-2">Create your account</h1>

        {demoType && (
          <p className="text-sm text-gray-400 mb-4">
            Setting up your <b>{demoType}</b> chatbot 🚀
          </p>
        )}

        <button
          onClick={handleGoogleSignup}
          className="w-full bg-white text-black p-3 rounded mb-4 font-medium"
        >
          Continue with Google
        </button>

        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full p-3 mb-3 bg-gray-800 rounded outline-none focus:ring-1 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            required
            className="w-full p-3 mb-3 bg-gray-800 rounded outline-none focus:ring-1 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 p-3 rounded font-bold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Start Free Trial"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}