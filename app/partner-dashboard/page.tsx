import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabaseServer';
import PartnerRegistrationForm from './PartnerRegistrationForm';

export default async function PartnerDashboard() {
  const supabase = createServerClient();

  // 1. Get the user. This is the part that was failing and redirecting you.
  // By using the server client with cookies, this will now see your session.
  const { data: { user }, error } = await supabase.auth.getUser();

  // 2. If no user, redirect to login
  if (!user || error) {
    console.error("Auth error or no user found:", error);
    redirect('/login');
  }

  // 3. Check if they are already a partner
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 4. If partner exists, show the dashboard info
  if (partner) {
    return (
      <div className="min-h-screen bg-black text-white p-10">
        <h1 className="text-3xl font-bold mb-4">Partner Dashboard</h1>
        <div className="p-6 bg-[#111] border border-gray-800 rounded-xl">
          <p className="text-gray-400">Welcome, {partner.business_name}</p>
          <p className="mt-2 text-blue-400">Referral Code: {partner.referral_code}</p>
        </div>
      </div>
    );
  }

  // 5. If NOT a partner, show the form and pass the valid user.id
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-3xl font-bold mb-2">Partner Registration</h2>
      <p className="text-gray-400 mb-8">Enter your details to create your partner account.</p>
      
      {/* user.id is now guaranteed to be a valid UUID string here */}
      <PartnerRegistrationForm userId={user.id} />
    </div>
  );
}