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

    // Referral
    const refFromUrl = params.get("ref");
    const refFromStorage = localStorage.getItem("referral");

    if (refFromUrl) {
      setReferralCode(refFromUrl);
      localStorage.setItem("referral", refFromUrl);
    } else if (refFromStorage) {
      setReferralCode(refFromStorage);
    }

    // Demo tracking (🔥 important)
    const demo = localStorage.getItem("demo_type");
    if (demo) {
      setDemoType(demo);
      console.log("User came from demo:", demo);
    }
  }, []);

  // ✅ Email Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      alert("Signup successful 🎉");

      // Optional: store demo type in DB later
      // You can insert into users table here if needed

      router.push("/redirect"); // ✅ go to redirect logic
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Google Signup
  const handleGoogleSignup = async () => {
    try {
      const redirectUrl =
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000/redirect"
          : `${window.location.origin}/redirect`;

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
    } catch (err: any) {
      alert("Google signup failed");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="bg-gray-900 p-10 rounded-xl w-full max-w-md shadow-lg">

        {/* TITLE */}
        <h1 className="text-2xl font-bold mb-2">
          Create your account
        </h1>

        {/* 🔥 Demo personalization */}
        {demoType && (
          <p className="text-sm text-gray-400 mb-4">
            Setting up your <b>{demoType}</b> chatbot 🚀
          </p>
        )}

        {/* GOOGLE */}
        <button
          onClick={handleGoogleSignup}
          className="w-full bg-white text-black p-3 rounded mb-4 font-medium"
        >
          Continue with Google
        </button>

        {/* FORM */}
        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email"
            required
            className="w-full p-3 mb-3 bg-gray-800 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            required
            className="w-full p-3 mb-3 bg-gray-800 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 p-3 rounded font-bold hover:bg-blue-700 transition"
          >
            {loading ? "Creating account..." : "Start Free Trial"}
          </button>
        </form>

        {/* LOGIN */}
        <p className="mt-4 text-sm text-gray-400">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-400">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}