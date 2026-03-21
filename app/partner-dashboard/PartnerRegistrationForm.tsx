'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!name.trim()) return;
    
    setLoading(true);
    console.log("Registering partner for User ID:", userId);

    // Generate a unique code (e.g., AZA-X8Y2Z)
    const prefix = name.trim().substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `${prefix}-${random}`;

    try {
      // Insert into the 'partners' table
      const { error } = await supabase
        .from('partners')
        .insert([
          {
            user_id: userId,
            business_name: name.trim(),
            referral_code: referralCode,
            commission_rate: 20
          }
        ]);

      if (error) {
        console.error("Database Error:", error.message);
        alert("Could not create account: " + error.message);
        setLoading(false);
      } else {
        // Success! Force a hard refresh to show the new dashboard
        window.location.href = "/partner-dashboard";
      }
    } catch (err) {
      console.error("System Error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
      <input 
        required
        disabled={loading}
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white outline-none focus:border-blue-500 transition-colors"
        placeholder="Your Business Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      
      <button 
        type="button" 
        onClick={handleJoin}
        disabled={loading || !name.trim()}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Setting up account...' : 'Create My Partner Account'}
      </button>

      {!userId && (
        <p className="text-red-500 text-xs mt-2">Error: No active session found.</p>
      )}
    </div>
  );
}