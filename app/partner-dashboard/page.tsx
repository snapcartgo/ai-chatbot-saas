"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PartnerPage() {
  const [partner, setPartner] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPartner, setIsPartner] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const router = useRouter();

  // Helper to format currency in INR
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount || 0);
  };

  useEffect(() => {
    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (partnerData) {
        setPartner(partnerData);
        setIsPartner(true);
        
        // Fetch referrals including the 'amount' (Total Paid) and 'commission_amount' (20%)
        const { data: refData } = await supabase
          .from("referrals")
          .select("id, referred_email, amount, commission_amount, payment_status, created_at")
          .eq("partner_id", partnerData.referral_code)
          .order('created_at', { ascending: false });
          
        setReferrals(refData || []);
      } 
      setLoading(false);
    };

    checkStatus();
  }, [router]);

  // Calculate Total Earnings (Sum of all paid commissions)
  const totalEarnings = referrals
    .filter(ref => ref.payment_status === 'paid')
    .reduce((sum, ref) => sum + (Number(ref.commission_amount) || 0), 0);

  const handlePartnerRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Session expired.");

      const refCode = `PNR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const { error: insertError } = await supabase
        .from("partners")
        .insert([{ 
          user_id: user.id, 
          email: user.email, 
          business_name: businessName, 
          referral_code: refCode,
          commission_rate: 20 
        }]);

      if (insertError) throw insertError;
      window.location.reload();

    } catch (err: any) {
      alert("Registration failed: " + err.message);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <p className="animate-pulse">Verifying Partner Status...</p>
    </div>
  );

  if (!isPartner) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-900 p-8 rounded-2xl border border-gray-800">
          <h1 className="text-2xl font-bold mb-6">Partner Registration</h1>
          <form onSubmit={handlePartnerRegistration} className="space-y-4">
            <input 
              required
              className="w-full bg-black border border-gray-700 p-3 rounded-lg"
              placeholder="Business Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
            <button type="submit" className="w-full bg-blue-600 py-3 rounded-lg font-bold">
              Create Partner Account
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold">Partner Dashboard</h1>
            <p className="text-blue-500">Welcome, {partner.business_name}</p>
          </div>
          <p className="text-sm font-mono text-gray-500">ID: {partner.referral_code}</p>
        </header>

        {/* Analytics Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-500 text-xs font-bold mb-2 uppercase">Total Referrals</p>
            <h2 className="text-4xl font-black">{referrals.length}</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-500 text-xs font-bold mb-2 uppercase">Total Earnings (Paid)</p>
            <h2 className="text-4xl font-black text-green-400">{formatINR(totalEarnings)}</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-500 text-xs font-bold mb-4 uppercase">Referral Link</p>
            <div className="bg-black border border-gray-700 p-3 rounded-lg flex justify-between items-center">
              <code className="text-blue-400 text-xs truncate mr-2">
                {`http://localhost:3000/signup?ref=${partner.referral_code}`}
              </code>
              <button onClick={() => {
                navigator.clipboard.writeText(`http://localhost:3000/signup?ref=${partner.referral_code}`);
                alert("Link Copied!");
              }} className="text-[10px] bg-blue-600 px-3 py-1 rounded font-bold">COPY</button>
            </div>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-800/50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-5">User Email</th>
                <th className="p-5">Total Paid (Customer)</th>
                <th className="p-5">Commission (20%)</th>
                <th className="p-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {referrals.length > 0 ? (
                referrals.map(ref => (
                  <tr key={ref.id} className="hover:bg-white/5 transition">
                    <td className="p-5 text-sm">{ref.referred_email}</td>
                    <td className="p-5 text-sm text-gray-400">
                      {formatINR(ref.amount)}
                    </td>
                    <td className="p-5 text-sm font-bold text-green-400">
                      {formatINR(ref.commission_amount)}
                    </td>
                    <td className="p-5">
                      <span className={`text-[10px] uppercase px-3 py-1 rounded-full font-black border ${
                        ref.payment_status === 'paid' 
                          ? 'text-green-500 border-green-500/20 bg-green-500/5' 
                          : 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'
                      }`}>
                        {ref.payment_status || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="p-10 text-center text-gray-600 italic">No referrals found. Start sharing your link!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}