import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import PartnerRegistrationForm from './PartnerRegistrationForm';
import { redirect } from 'next/navigation';

export default async function PartnerDashboard() {
  // 1. Get session using the more reliable getSession() for Server Components
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  // 2. If no session exists or there's an error, try one more check or redirect
  if (!session || !session.user) {
    console.log("No session found on server, redirecting to login...");
    redirect('/login');
  }

  const user = session.user;

  // 3. Check if they are already a partner
  const { data: partner } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 4. Show dashboard if partner exists
  if (partner) {
    return (
      <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center">
        <h1 className="text-3xl font-bold">Partner Dashboard</h1>
        <div className="mt-8 p-6 bg-[#111] border border-gray-800 rounded-xl w-full max-w-2xl">
          <p className="text-xl font-semibold">Welcome back, {partner.business_name}</p>
          <div className="mt-6 p-4 bg-black border border-blue-900/30 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Your Referral Link:</p>
            <code className="text-blue-400 break-all text-sm">
              https://ai-chatbot-saas-five.vercel.app?ref={partner.referral_code}
            </code>
          </div>
        </div>
      </div>
    );
  }

  // 5. Show registration if logged in but not a partner yet
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h2 className="text-3xl font-bold mb-2">Partner Registration</h2>
        <p className="text-gray-400 mb-8">
          Join our partner program to start earning.
        </p>
        <PartnerRegistrationForm userId={user.id} />
      </div>
    </div>
  );
}