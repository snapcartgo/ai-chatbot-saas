"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  // ✅ EMAIL LOGIN
  const handleLogin = async (e: any) => {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dashboard");
  };

  // ✅ GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/dashboard", // change in production
      },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">

      <div className="grid md:grid-cols-2 bg-gray-900 rounded-xl overflow-hidden shadow-lg max-w-4xl w-full">

        {/* Left Section */}
        <div className="p-10 hidden md:flex flex-col justify-center bg-blue-600">

          <h2 className="text-3xl font-bold mb-6">
            Welcome Back
          </h2>

          <p className="mb-6">
            Log in to manage your AI chatbots, view conversations,
            and capture new leads automatically.
          </p>

          <ul className="space-y-3 text-sm">
            <li>✔ Manage multiple chatbots</li>
            <li>✔ Track conversations</li>
            <li>✔ Capture leads automatically</li>
            <li>✔ View analytics dashboard</li>
          </ul>

        </div>

        {/* Right Section */}
        <div className="p-10">

          <h1 className="text-2xl font-bold mb-2">
            Login to your account
          </h1>

          <p className="text-gray-400 mb-6">
            Access your AI chatbot dashboard.
          </p>

          {/* ✅ GOOGLE BUTTON */}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black p-3 rounded-lg font-semibold mb-4"
          >
            Continue with Google
          </button>

          {/* Divider */}
          <div className="text-center text-gray-400 text-sm mb-4">
            OR
          </div>

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Email */}
            <input
              type="email"
              placeholder="Email address"
              className="w-full p-3 rounded bg-gray-800 border border-gray-700"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {/* Password */}
            <div className="relative">

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full p-3 rounded bg-gray-800 border border-gray-700 pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400"
              >
                {showPassword ? "🙈" : "👁"}
              </button>

            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <a
                href="/forgot-password"
                className="text-sm text-blue-400 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded font-semibold"
            >
              Login
            </button>

          </form>

          <p className="text-gray-400 text-sm mt-6">
            Don’t have an account?{" "}
            <a href="/signup" className="text-blue-400">
              Create one
            </a>
          </p>

        </div>

      </div>

    </main>
  );
}