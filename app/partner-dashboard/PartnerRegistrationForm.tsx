'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!name.trim()) return;

    setLoading(true);

    const prefix = name.trim().substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `${prefix}-${random}`;

    const { data, error } = await supabase
      .from('partners')
      .insert({
        user_id: userId,
        business_name: name.trim(),
        referral_code: referralCode,
        commission_rate: 20
      });

    if (error) {
      console.error(error);
      alert(error.message);
      setLoading(false);
      return;
    }

    window.location.reload();
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-xs mx-auto">
      <input
        disabled={loading}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Business Name"
      />

      <button onClick={handleJoin} disabled={loading}>
        {loading ? 'Creating...' : 'Create Partner'}
      </button>
    </div>
  );
}