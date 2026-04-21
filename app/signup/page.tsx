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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      alert("Signup successful");

      router.push("/redirect"); // ✅ important
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
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
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">
      <div className="bg-gray-900 p-10 rounded-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">Create your account</h1>

        <button
          onClick={handleGoogleSignup}
          className="w-full bg-white text-black p-3 rounded mb-4"
        >
          Continue with Google
        </button>

        <form onSubmit={handleSignup}>
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 mb-3 bg-gray-800"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 mb-3 bg-gray-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="w-full bg-blue-600 p-3">
            {loading ? "Loading..." : "Start Free Trial"}
          </button>
        </form>

        <p className="mt-4 text-sm">
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </main>
  );
}