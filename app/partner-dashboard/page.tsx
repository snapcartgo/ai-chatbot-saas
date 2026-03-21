import { createClient } from '@supabase/supabase-js'; // Or your local supabase path
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function PartnerDashboard() {
  const cookieStore = await cookies();
  
  // 1. Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Get the current logged-in user (Make sure you have auth set up)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login'); // Send them to login if not authenticated
  }

  // 3. Fetch Partner Data
  const { data: partner, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 4. If they aren't a partner yet, show a "Join" button or redirect
  if (!partner) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-bold mb-4">Become a Partner</h1>
        <p className="text-gray-400 mb-6 text-center max-w-md">
          Join our agency program to earn 20% commission on every client you refer to our AI Chatbot platform.
        </p>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold">
          Apply to Join
        </button>
      </div>
    );
  }

  // 5. Fetch their Referrals for the list
  const { data: referrals } = await supabase
    .from('referrals')
    .select('*')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false });

  const shareUrl = `https://your-site-url.vercel.app?ref=${partner.referral_code}`;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-blue-500">Partner Dashboard</h1>
          <p className="text-gray-400">Welcome back, {partner.business_name}</p>
        </header>

        {/* --- STATS SECTION --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111] p-6 rounded-2xl border border-gray-800">
            <p className="text-gray-400 text-sm uppercase">Total Referrals</p>
            <h2 className="text-3xl font-bold mt-1">{referrals?.length || 0}</h2>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-gray-800">
            <p className="text-gray-400 text-sm uppercase">Unpaid Commission</p>
            <h2 className="text-3xl font-bold mt-1 text-green-500">₹0.00</h2>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-blue-900/30">
            <p className="text-blue-400 text-sm uppercase font-bold">Commission Rate</p>
            <h2 className="text-3xl font-bold mt-1">{partner.commission_rate}%</h2>
          </div>
        </div>

        {/* --- REFERRAL LINK SECTION --- */}
        <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-2xl mb-10">
          <h3 className="text-xl font-bold mb-4">Your Unique Agency Link</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              readOnly 
              value={shareUrl}
              className="flex-grow bg-black/50 border border-gray-700 p-4 rounded-xl text-blue-300 font-mono"
            />
            <button className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-xl font-bold transition-all">
              Copy Link
            </button>
          </div>
        </div>

        {/* --- RECENT ACTIVITY TABLE --- */}
        <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-gray-800">
            <h3 className="font-bold">Recent Referrals</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-900/50 text-gray-400 text-sm">
              <tr>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {referrals?.map((ref) => (
                <tr key={ref.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                  <td className="p-4">{ref.referred_email}</td>
                  <td className="p-4 text-gray-500 text-sm">{new Date(ref.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      ref.status === 'converted' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {ref.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {(!referrals || referrals.length === 0) && (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-gray-500 italic">No referrals yet. Share your link to get started!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}