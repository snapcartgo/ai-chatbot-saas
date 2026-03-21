'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  // Using the dedicated Next.js browser client for reliability
  const supabase = createClientComponentClient();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit Clicked - User ID:", userId); // LOG 1
    setLoading(true);

    if (!userId || userId === "") {
      console.error("No User ID found! Cannot insert."); // LOG 2
      alert("Session error: Please log out and log back in.");
      setLoading(false);
      return;
    }

    // Generate Referral Code: AZA-X1Y2Z
    const cleanName = name.trim().substring(0, 3).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `${cleanName}-${randomStr}`;
    console.log("Generated code:", code); // LOG 3

    try {
      const { data, error } = await supabase
        .from('partners')
        .insert([
          {
            user_id: userId,
            business_name: name,
            referral_code: code,
            commission_rate: 20,
          },
        ])
        .select(); // Added .select() to confirm data return

      if (error) {
        console.error("Supabase Database Error:", error); // LOG 4
        alert("Database Error: " + error.message);
        setLoading(false);
      } else {
        console.log("Success! Data saved:", data); // LOG 5
        // Use location.href to force the server-side page.tsx to re-run
        window.location.href = "/partner-dashboard";
      }
    } catch (err) {
      console.error("Unexpected Error:", err);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-xs mx-auto">
      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400 ml-1">Business or Agency Name</label>
        <input 
          required
          autoFocus
          className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white outline-none focus:border-blue-500 transition-all"
          placeholder="e.g. Azaadi Digital"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <button 
        type="submit"
        disabled={loading || !userId}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Creating Account...
          </span>
        ) : (
          'Create My Partner Account'
        )}
      </button>
      
      {!userId && (
        <p className="text-red-500 text-xs text-center mt-2">
          Authentication error. Please refresh the page.
        </p>
      )}
    </form>
  );
}