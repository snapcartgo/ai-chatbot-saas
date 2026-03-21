'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    // This check is what was triggering your error
    if (!userId) {
      alert("Error: User session not detected. Please refresh.");
      return;
    }

    setLoading(true);
    const code = `${name.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const { error } = await supabase.from('partners').insert([{
      user_id: userId,
      business_name: name,
      referral_code: code,
      commission_rate: 20
    }]);

    if (error) {
      alert("Database Error: " + error.message);
      setLoading(false);
    } else {
      window.location.reload(); // Refresh to show dashboard
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xs">
      <input 
        required
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white"
        placeholder="Business Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button 
        onClick={handleJoin}
        disabled={loading || !name}
        className="bg-blue-600 p-3 rounded-lg font-bold disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Create My Partner Account'}
      </button>
    </div>
  );
}