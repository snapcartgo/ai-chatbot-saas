import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Using your existing working client
import PartnerRegistrationForm from './PartnerRegistrationForm';

export default async function PartnerDashboard() {
  // 1. Get user session from cookies securely
  const cookieStore = cookies();
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Redirect to login if no user is found
  if (!user) {
    redirect('/login');
  }

  // 3. Check if this user is already in the 'partners' table
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 4. Show dashboard if they are already a partner
  if (partner) {
    return (
      <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center">
        <h1 className="text-3xl font-bold">Partner Dashboard</h1>
        <div className="mt-8 p-6 bg-[#111] border border-gray-800 rounded-xl w-full max-w-2xl text-center">
          <p className="text-xl font-semibold">Welcome, {partner.business_name}!</p>
          <div className="mt-6 p-4 bg-black border border-blue-900/30 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Your Referral Link:</p>
            <code className="text-blue-400 break-all">
              https://ai-chatbot-saas-five.vercel.app?ref={partner.referral_code}
            </code>
          </div>
          <p className="mt-4 text-green-500 font-medium">Commission Rate: {partner.commission_rate}%</p>
        </div>
      </div>
    );
  }

  // 5. Otherwise, show the registration form and pass the REAL user.id
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-3xl font-bold mb-2">Partner Registration</h2>
      <p className="text-gray-400 mb-8 max-w-sm">
        Enter your agency or business name to start earning 20% commission on every referral.
      </p>
      
      {/* Passing user.id here ensures we don't get the 'invalid uuid' error */}
      <PartnerRegistrationForm userId={user.id} />
    </div>
  );
}