'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!name.trim() || !userId) return;
    
    setLoading(true);

    const prefix = name.trim().substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `${prefix}-${random}`;

    try {
      const { error } = await supabase
        .from('partners')
        .insert([{
            user_id: userId,
            business_name: name.trim(),
            referral_code: referralCode,
            commission_rate: 20
        }]);

      if (error) {
        alert("Error: " + error.message);
        setLoading(false);
      } else {
        // Hard refresh to update server state
        window.location.href = "/partner-dashboard";
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <input 
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white"
        placeholder="Agency or Business Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button 
        type="button"
        onClick={handleJoin}
        disabled={loading || !name.trim()}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Registering...' : 'Create My Partner Account'}
      </button>
    </div>
  );
}