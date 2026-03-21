'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    // 1. Immediate visual feedback
    console.log("Action Triggered: Attempting to save...");
    setLoading(true);

    // 2. Safety check for User ID
    if (!userId || userId === "") {
      alert("Error: User session not detected. Please refresh.");
      setLoading(false);
      return;
    }

    // 3. Generate Referral Code
    const cleanName = name.trim().substring(0, 3).toUpperCase() || "USR";
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `${cleanName}-${randomStr}`;

    try {
      // 4. Supabase Insert
      const { error } = await supabase
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
        console.error("Database Error:", error.message);
        alert("Database Error: " + error.message);
        setLoading(false);
      } else {
        console.log("Success! Redirecting...");
        // 5. Force the page to reload so the dashboard shows up
        window.location.href = "/partner-dashboard";
      }
    } catch (err) {
      console.error("Critical System Error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
      <input 
        required
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white outline-none focus:border-blue-500"
        placeholder="Business or Agency Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      
      <button 
        type="button" 
        onClick={handleJoin}
        disabled={loading || !name}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Creating Account...' : 'Create My Partner Account'}
      </button>

      {/* Debugger text - you can remove this after it works */}
      {!userId && <p className="text-red-500 text-xs">Waiting for User Session...</p>}
    </div>
  );
}