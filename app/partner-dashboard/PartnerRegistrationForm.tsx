'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js'; // Use your client-side config if you have one
import { useRouter } from 'next/navigation';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Generate unique code (e.g., AZA-X82F1)
    const prefix = businessName.toUpperCase().replace(/\s/g, '').substring(0, 3);
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `${prefix}-${random}`;

    const { error } = await supabase
      .from('partners')
      .insert([
        { 
          user_id: userId, 
          business_name: businessName, 
          referral_code: referralCode,
          commission_rate: 20 
        }
      ]);

    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.refresh(); // This reloads the page to show the dashboard
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      <input
        required
        type="text"
        placeholder="Your Agency Name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        className="w-full bg-[#111] border border-gray-800 p-3 rounded-lg text-white mb-4 outline-none focus:border-blue-500"
      />
      <button
        disabled={loading}
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all"
      >
        {loading ? 'Registering...' : 'Get My Referral Link'}
      </button>
    </form>
  );
}