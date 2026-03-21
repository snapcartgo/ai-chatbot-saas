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
  console.log("Button clicked!"); // LOG 1
  setLoading(true);

  if (!userId) {
    console.error("No User ID found!"); // LOG 2
    setLoading(false);
    return;
  }

  const code = `${name.substring(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  console.log("Generated code:", code); // LOG 3

  const { data, error } = await supabase.from('partners').insert([{
    user_id: userId,
    business_name: name,
    referral_code: code,
    commission_rate: 20
  }]);

  if (error) {
    console.error("Supabase Database Error:", error); // LOG 4
    alert("Database Error: " + error.message);
    setLoading(false);
  } else {
    console.log("Success! Data saved:", data); // LOG 5
    window.location.href = "/partner-dashboard";
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