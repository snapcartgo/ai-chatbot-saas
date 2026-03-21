import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Use your existing working client
import PartnerRegistrationForm from './PartnerRegistrationForm';

export default async function PartnerDashboard() {
  // Fetch the user session from the server side
  const { data: { user } } = await supabase.auth.getUser();

  // If no user is found, redirect to login page
  if (!user) {
    redirect('/login');
  }

  // Check if they are already a partner
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (partner) {
    return (
      <div className="min-h-screen bg-black text-white p-10">
        <h1 className="text-2xl font-bold">Welcome, {partner.business_name}</h1>
        <p className="mt-4 text-gray-400">Referral Code: {partner.referral_code}</p>
      </div>
    );
  }

  // Pass the REAL user.id to the form component
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-3xl font-bold mb-6">Partner Registration</h2>
      <PartnerRegistrationForm userId={user.id} />
    </div>
  );
}