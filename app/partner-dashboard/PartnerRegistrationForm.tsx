'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Use your existing supabase client
import { useRouter } from 'next/navigation';

export default function PartnerRegistrationForm({ userId }: { userId: string }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // STOP if userId is empty to prevent the UUID error
    if (!userId || userId === "") {
      alert("User session not found. Please refresh the page and try again.");
      return;
    }

    setLoading(true);

    // Generate a clean referral code
    const cleanName = name.trim().substring(0, 3).toUpperCase();
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `${cleanName}-${randomStr}`;

    const { error } = await supabase.from('partners').insert([{
      user_id: userId, // This must be a valid UUID string
      business_name: name,
      referral_code: code,
      commission_rate: 20
    }]);

    if (error) {
      console.error("Supabase Error:", error);
      alert(error.message);
      setLoading(false);
    } else {
      router.refresh(); 
    }
  };

  return (
    <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-xs">
      <input 
        required
        className="bg-[#111] border border-gray-800 p-3 rounded-lg text-white outline-none focus:border-blue-500"
        placeholder="Business or Agency Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button 
        disabled={loading || !userId}
        className="bg-blue-600 p-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Generating Link...' : 'Create My Partner Account'}
      </button>
    </form>
  );
}