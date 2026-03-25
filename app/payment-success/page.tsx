"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function SuccessContent() {
  const searchParams = useSearchParams();
  
  // 1. PayU redirects back with 'udf1' (email) and 'amount' if passed in the URL
  const userEmail = (searchParams.get("udf1") || searchParams.get("email") || "").toLowerCase().trim();
  const amountPaid = Number(searchParams.get("amount")) || 0;

  const [loading, setLoading] = useState(true);
  const [commissionUpdated, setCommissionUpdated] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
  const updateDatabase = async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    const cleanEmail = userEmail.toLowerCase().trim();

    // ✅ Fix: no default 499
    const finalAmount = amountPaid || 0;

    const calculatedCommission = finalAmount * 0.20;

    console.log("Email:", cleanEmail);
    console.log("Amount:", finalAmount);
    console.log("Commission:", calculatedCommission);

    // ✅ Check if referral exists first
    const { data: refCheck, error: checkError } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_email", cleanEmail)
      .maybeSingle();

    console.log("Referral Found:", refCheck);

    if (checkError) {
      console.error("Check Error:", checkError.message);
    }

    if (refCheck) {
      const { error: refError } = await supabase
        .from("referrals")
        .update({
          amount: finalAmount,
          commission_amount: calculatedCommission,
          payment_status: finalAmount > 0 ? "paid" : "free",
          status: finalAmount > 0 ? "completed" : "free",
        })
        .eq("referred_email", cleanEmail);

      if (!refError) {
        setCommissionUpdated(true);
        console.log("Partner commission updated successfully ✅");
      } else {
        console.error("Referral update error:", refError.message);
      }
    } else {
      console.log("No referral found ❌ (email mismatch likely)");
    }

    setLoading(false);
  };

  updateDatabase();
}, [userEmail, amountPaid, supabase]); 

  if (loading) return <div className="text-center p-10 text-white bg-black min-h-screen font-mono">Verifying payment...</div>;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full p-8 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 text-center">
        <div className="mb-4 text-green-500 text-5xl">✅</div>
        <h1 className="text-2xl font-bold text-white">Payment Successful!</h1>
        <p className="text-gray-400 mt-2">Welcome to the AI Chatbot SaaS</p>
        
        <div className="mt-6 p-5 bg-black rounded-xl text-left text-sm border border-gray-800">
          <div className="flex justify-between mb-2">
            <span className="text-gray-500">Buyer Email:</span>
            <span className="text-white font-medium">{userEmail}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-500">Amount Paid:</span>
            <span className="text-white font-bold">₹{amountPaid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Status:</span>
            <span className="text-green-400 font-bold uppercase tracking-wider">Paid</span>
          </div>
        </div>

        {commissionUpdated ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-6">
             <p className="text-[11px] text-green-400 uppercase font-bold tracking-widest">
              Partner Commission Credited
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-gray-600 mt-6 uppercase tracking-widest">
            Processing Dashboard Sync...
          </p>
        )}

        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg"
        >
          Go to My Dashboard
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div className="text-center p-10 bg-black min-h-screen text-white">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}