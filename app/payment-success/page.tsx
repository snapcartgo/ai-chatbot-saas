"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function SuccessContent() {
  const searchParams = useSearchParams();

  const userEmail = (searchParams.get("udf1") || searchParams.get("email") || "")
    .toLowerCase()
    .trim();

  const amountPaid = Number(searchParams.get("amount")) || 1;

  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const updateDatabase = async () => {
      try {
        console.log("Email:", userEmail);
        console.log("Amount:", amountPaid);

        // ✅ GET USER
        // 🔥 Get user id from profiles table using email
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", userEmail)
            .single();

          const uid = profile?.id;

console.log("UID from profile:", uid);

        console.log("UID:", uid);

        if (!uid) {
          console.log("No user logged in ❌");
          setLoading(false);
          return;
        }

        // ----------------------------------
        // ✅ STEP 1: DEBUG (VERY IMPORTANT)
        // ----------------------------------
        const { data: allSubs } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", uid);

        console.log("All subscriptions:", allSubs);

        // ----------------------------------
        // ✅ STEP 2: UPDATE CORRECT PLAN
        // ----------------------------------
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            amount: amountPaid,
            status: "active",
          })
          .match({
            user_id: uid,
            plan: "growth",
          });

        if (subError) {
          console.error("Subscription Error:", subError.message);
        } else {
          console.log("Subscription updated ✅");
        }

        // ----------------------------------
        // ✅ STEP 3: UPDATE REFERRALS
        // ----------------------------------
        const commission = amountPaid * 0.2;

        const { data: refCheck } = await supabase
          .from("referrals")
          .select("*")
          .eq("referred_email", userEmail)
          .maybeSingle();

        console.log("Referral Found:", refCheck);

        if (refCheck) {
          const { error: refError } = await supabase
            .from("referrals")
            .update({
              amount: amountPaid,
              commission_amount: commission,
              payment_status: "paid",
              status: "completed",
            })
            .eq("referred_email", userEmail);

          if (refError) {
            console.error("Referral Error:", refError.message);
          } else {
            console.log("Referral updated ✅");
          }
        } else {
          console.log("No referral found ❌");
        }

        setUpdated(true);
      } catch (err) {
        console.error("Update failed:", err);
      } finally {
        setLoading(false);
      }
    };

    updateDatabase();
  }, [userEmail, amountPaid, supabase]);

  if (loading)
    return (
      <div className="text-center p-10 text-white bg-black min-h-screen">
        Processing Payment...
      </div>
    );

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 bg-gray-900 rounded-2xl border border-gray-800 text-center">
        <div className="text-green-500 text-5xl mb-4">✅</div>

        <h1 className="text-2xl font-bold text-white">
          Payment Successful!
        </h1>

        <div className="mt-6 text-left text-sm bg-black p-4 rounded-xl border border-gray-800">
          <p className="text-gray-400">Email:</p>
          <p className="text-white font-medium">{userEmail}</p>

          <p className="text-gray-400 mt-3">Amount:</p>
          <p className="text-white font-bold">₹{amountPaid}</p>
        </div>

        {updated && (
          <p className="text-green-400 mt-4 text-sm">
            Database Updated Successfully ✅
          </p>
        )}

        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div className="bg-black min-h-screen"></div>}>
      <SuccessContent />
    </Suspense>
  );
}