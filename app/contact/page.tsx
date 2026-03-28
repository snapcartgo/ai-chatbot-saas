"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    website: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("contact_leads").insert([form]);

    if (error) {
      alert("Error saving data ❌");
      console.error(error);
    } else {
      alert("Message sent successfully ✅");
      setForm({ name: "", email: "", website: "", message: "" });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-center">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-gray-900 p-6 rounded-xl w-full max-w-md"
      >
        <input
          type="text"
          placeholder="Your Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full p-3 bg-black border border-gray-700 rounded"
        />

        <input
          type="email"
          placeholder="Your Email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full p-3 bg-black border border-gray-700 rounded"
        />

        <input
          type="url"
          placeholder="Your Website (Required)"
          required
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          className="w-full p-3 bg-black border border-gray-700 rounded"
        />

        <textarea
          placeholder="Your Message"
          required
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full p-3 bg-black border border-gray-700 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 p-3 rounded font-bold"
        >
          {loading ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}