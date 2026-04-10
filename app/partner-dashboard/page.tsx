"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PartnerPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPartner, setIsPartner] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [createError, setCreateError] = useState("");
  const router = useRouter();

  const formatINR = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount || 0);

  useEffect(() => {
    const checkStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUser(user);

      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (partnerData) {
        setPartner(partnerData);
        setIsPartner(true);

        // IMPORTANT: fetch payout status from commissions table
        const { data: refData } = await supabase
          .from("referrals")
          .select(`
            id,
            referred_email,
            amount,
            commission_amount,
            payment_status,
            purchased_plan,
            created_at,
            commissions:commissions!left(status,payout_date)
          `)
          .or(`partner_id.eq.${partnerData.id},partner_id.eq.${partnerData.referral_code}`)
          .order("created_at", { ascending: false });

        setReferrals(refData || []);
      }

      setLoading(false);
    };

    checkStatus();
  }, [router]);

  // Total commission generated (customer paid)
  const totalGenerated = referrals.reduce(
    (sum, r) => sum + (Number(r.commission_amount) || 0),
    0
  );

  // Total payout completed (you paid partner)
  const totalPaidOut = referrals.reduce((sum, r) => {
    const payoutStatus = r.commissions?.[0]?.status || "pending";
    if (payoutStatus === "paid") {
      return sum + (Number(r.commission_amount) || 0);
    }
    return sum;
  }, 0);

  const handleCreatePartner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!currentUser) return;

    const trimmedName = businessName.trim();
    if (!trimmedName) {
      setCreateError("Please enter a business name.");
      return;
    }

    setCreatingPartner(true);
    setCreateError("");

    const prefix = trimmedName.substring(0, 3).toUpperCase().padEnd(3, "X");
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const referralCode = `${prefix}-${random}`;

    const { data, error } = await supabase
      .from("partners")
      .insert({
        user_id: currentUser.id,
        business_name: trimmedName,
        referral_code: referralCode,
        commission_rate: 20,
      })
      .select("*")
      .single();

    if (error) {
      setCreateError(error.message);
      setCreatingPartner(false);
      return;
    }

    setPartner(data);
    setIsPartner(true);
    setBusinessName("");
    setReferrals([]);
    setCreatingPartner(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  if (!isPartner) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-4 text-white">
        <div className="w-full max-w-md bg-gray-900 p-6 rounded-xl">
          <h1 className="text-xl font-bold mb-4">Partner Registration</h1>

          <form className="space-y-3" onSubmit={handleCreatePartner}>
            <input
              className="w-full bg-black border p-3 rounded"
              placeholder="Business Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />

            {createError ? (
              <p className="text-red-400 text-sm">{createError}</p>
            ) : null}

            <button
              type="submit"
              disabled={creatingPartner}
              className="w-full bg-blue-600 py-3 rounded disabled:opacity-60"
            >
              {creatingPartner ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 w-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-3xl font-bold">Partner Dashboard</h1>
            <p className="text-blue-500 text-sm md:text-base">
              Welcome, {partner.business_name}
            </p>
          </div>

          <p className="text-xs md:text-sm text-gray-400">ID: {partner.referral_code}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-gray-900 p-5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Total Referrals</p>
            <h2 className="text-2xl md:text-4xl font-bold">{referrals.length}</h2>
          </div>

          <div className="bg-gray-900 p-5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Total Commission Generated</p>
            <h2 className="text-green-400 text-2xl md:text-4xl font-bold">
              {formatINR(totalGenerated)}
            </h2>
          </div>

          <div className="bg-gray-900 p-5 rounded-xl">
            <p className="text-gray-400 text-xs mb-1">Total Paid To Partner</p>
            <h2 className="text-yellow-400 text-2xl md:text-4xl font-bold">
              {formatINR(totalPaidOut)}
            </h2>
            <p className="text-xs text-gray-500 mt-2">
              This increases only when payout status becomes paid.
            </p>
          </div>
        </div>

        <div className="bg-gray-900 p-5 rounded-xl mb-8">
          <p className="text-gray-400 text-xs mb-2">Referral Link</p>
          <div className="flex flex-col gap-2">
            <code className="text-xs text-blue-400 break-all">
              {`https://ai-chatbot-saas-five.vercel.app/signup?ref=${partner.referral_code}`}
            </code>

            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `https://ai-chatbot-saas-five.vercel.app/signup?ref=${partner.referral_code}`
                );
                alert("Copied!");
              }}
              className="bg-blue-600 px-3 py-2 rounded text-xs"
            >
              Copy Link
            </button>
          </div>
        </div>

        <div className="overflow-x-auto bg-gray-900 rounded-xl">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Plan</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Commission</th>
                <th className="p-3 text-left">Customer Payment</th>
                <th className="p-3 text-left">Partner Payout</th>
                <th className="p-3 text-left">Payout Date</th>
              </tr>
            </thead>

            <tbody>
              {referrals.map((ref) => {
                const payoutStatus = ref.commissions?.[0]?.status || "pending";
                const payoutDate = ref.commissions?.[0]?.payout_date || null;

                return (
                  <tr key={ref.id} className="border-t border-gray-800">
                    <td className="p-3">{ref.referred_email || "-"}</td>
                    <td className="p-3 uppercase">{ref.purchased_plan || "-"}</td>
                    <td className="p-3">{formatINR(Number(ref.amount) || 0)}</td>
                    <td className="p-3 text-green-400">
                      {formatINR(Number(ref.commission_amount) || 0)}
                    </td>
                    <td className="p-3">{ref.payment_status || "pending"}</td>
                    <td
                      className={`p-3 ${
                        payoutStatus === "paid" ? "text-green-400" : "text-yellow-400"
                      }`}
                    >
                      {payoutStatus}
                    </td>
                    <td className="p-3">
                      {payoutDate ? new Date(payoutDate).toLocaleString("en-IN") : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
