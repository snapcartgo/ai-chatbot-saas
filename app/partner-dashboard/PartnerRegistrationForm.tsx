'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Generate Code
    const code = `${name.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const { error } = await supabase.from('partners').insert([{
      user_id: userId,
      business_name: name,
      referral_code: code,
      commission_rate: 20
    }]);

    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.refresh(); // This reloads the page, finds the new partner record, and shows the dashboard!
    }
  };

  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-xs">
      <input 
        required
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white"
        placeholder="Business or Agency Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button 
        disabled={loading}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 transition"
      >
        {loading ? 'Generating Link...' : 'Create My Partner Account'}
      </button>
    </form>
  );
}