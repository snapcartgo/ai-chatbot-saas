"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPassword() {

  const [email, setEmail] = useState("");

  const handleReset = async (e:any) => {
    e.preventDefault();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/update-password",
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Password reset email sent!");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-4">

      <div className="bg-gray-900 p-10 rounded-xl max-w-md w-full">

        <h1 className="text-2xl font-bold mb-6">
          Reset your password
        </h1>

        <form onSubmit={handleReset} className="space-y-4">

          <input
            type="email"
            placeholder="Enter your email"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 p-3 rounded"
          >
            Send Reset Link
          </button>

        </form>

      </div>

    </main>
  );
}