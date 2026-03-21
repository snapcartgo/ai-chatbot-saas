'use client';

import { useState } from 'react';
// Using your existing client as you intended in line 5 of your screenshot
import { supabase } from '@/lib/supabase'; 
// Fix: Import useRouter from 'next/navigation', NOT 'next/router'
import { useRouter } from 'next/navigation';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit Clicked - User ID:", userId);
    setLoading(true);

    if (!userId || userId === "") {
      console.error("No User ID found! Cannot insert.");
      alert("Session error: Please log out and log back in.");
      setLoading(false);
      return;
    }

    // Generate Referral Code (e.g., AZA-12345)
    const cleanName = name.trim().substring(0, 3).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `${cleanName}-${randomStr}`;

    try {
      // Insert into the partners table you configured in Supabase
      const { data, error } = await supabase
        .from('partners')
        .insert([
          {
            user_id: userId,
            business_name: name,
            referral_code: code,
            commission_rate: 20,
          },
        ]);

      if (error) {
        console.error("Supabase Database Error:", error);
        alert("Database Error: " + error.message);
        setLoading(false);
      } else {
        console.log("Success! Data saved:", data);
        // Force a hard reload to update the dashboard view
        window.location.href = "/partner-dashboard";
      }
    } catch (err) {
      console.error("Unexpected Error:", err);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-xs mx-auto">
      <input 
        required
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white outline-none focus:border-blue-500"
        placeholder="Business or Agency Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button 
        type="submit"
        disabled={loading || !userId}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Creating Account...' : 'Create My Partner Account'}
      </button>
    </form>
  );
}