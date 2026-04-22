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

  // 🔥 NEW STATES (IMPORTANT)
  const [demoType, setDemoType] = useState<"booking" | "ecommerce">("booking");
  const [industry, setIndustry] = useState("dentist");

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

  const totalGenerated = referrals.reduce(
    (sum, r) => sum + (Number(r.commission_amount) || 0),
    0
  );

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

  // 🔥 DEMO LINKS LOGIC
  const bookingLinks: any = {
    dentist: "/demos/dentist",
    salon: "/demos/salon",
    "real-estate": "/demos/real-estate",
    general: "/demos/general",
  };

  const getDemoLink = () => {
    if (!partner) return "";
    if (demoType === "booking") {
      return `${bookingLinks[industry]}?ref=${partner.referral_code}`;
    }
    return `/demos/ecommerce-preview?ref=${partner.referral_code}`;
  };

  const fullLink =
    typeof window !== "undefined"
      ? window.location.origin + getDemoLink()
      : "";

  const copyDemoLink = () => {
    navigator.clipboard.writeText(fullLink);
    alert("Demo link copied!");
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

            {createError && (
              <p className="text-red-400 text-sm">{createError}</p>
            )}

            <button
              type="submit"
              disabled={creatingPartner}
              className="w-full bg-blue-600 py-3 rounded"
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

        {/* HEADER */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Partner Dashboard</h1>
          <p className="text-blue-500">
            Welcome, {partner.business_name}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            💰 Share your referral link or demo pages with businesses.
            Earn recurring commission every month when they subscribe.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            ID: {partner.referral_code}
          </p>
        </div>

        {/* STATS */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 p-5 rounded-xl">
            <p className="text-gray-400 text-xs">Total Referrals</p>
            <h2 className="text-3xl font-bold">{referrals.length}</h2>
          </div>

          <div className="bg-gray-900 p-5 rounded-xl">
            <p className="text-gray-400 text-xs">Total Commission</p>
            <h2 className="text-green-400 text-3xl font-bold">
              {formatINR(totalGenerated)}
            </h2>
          </div>

          <div className="bg-gray-900 p-5 rounded-xl">
            <p className="text-gray-400 text-xs">Total Paid</p>
            <h2 className="text-yellow-400 text-3xl font-bold">
              {formatINR(totalPaidOut)}
            </h2>
          </div>
        </div>

        {/* REFERRAL LINK */}
        <div className="bg-gray-900 p-5 rounded-xl mb-8">
          <p className="text-gray-400 text-xs mb-2">Referral Link</p>

          <div className="flex gap-2">
            <input
              value={`https://ai-chatbot-saas-five.vercel.app/signup?ref=${partner.referral_code}`}
              readOnly
              className="flex-1 p-2 rounded bg-black text-sm"
            />
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `https://ai-chatbot-saas-five.vercel.app/signup?ref=${partner.referral_code}`
                )
              }
              className="bg-blue-600 px-4 rounded"
            >
              Copy
            </button>
          </div>
        </div>

        {/* 🔥 DEMO SECTION */}
        <div className="p-6 bg-[#0f172a] rounded-xl mb-8">
          <h2 className="text-xl font-semibold mb-4">🔗 Demo Pages</h2>

          <div className="flex gap-4 mb-4">
            <button
              onClick={() => setDemoType("booking")}
              className={`px-4 py-2 rounded ${
                demoType === "booking" ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              Booking
            </button>

            <button
              onClick={() => setDemoType("ecommerce")}
              className={`px-4 py-2 rounded ${
                demoType === "ecommerce" ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              E-commerce
            </button>
          </div>

          {demoType === "booking" && (
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full p-3 rounded bg-black mb-4"
            >
              <option value="dentist">Dentist</option>
              <option value="salon">Salon</option>
              <option value="real-estate">Real Estate</option>
              <option value="general">Other Business</option>
            </select>
          )}

          <div className="flex gap-2 mb-3">
            <input
              value={fullLink}
              readOnly
              className="flex-1 p-2 rounded bg-black text-sm"
            />
            <button onClick={copyDemoLink} className="bg-blue-600 px-4 rounded">
              Copy
            </button>
          </div>

          {/* WhatsApp Share */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              `Check this AI demo:\n${fullLink}`
            )}`}
            target="_blank"
            className="inline-block bg-green-600 px-4 py-2 rounded"
          >
            Share on WhatsApp
          </a>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto bg-gray-900 rounded-xl">
          <table className="w-full text-sm">
            <thead className="text-gray-400">
              <tr>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Plan</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Commission</th>
                <th className="p-3 text-left">Payment</th>
                <th className="p-3 text-left">Payout</th>
              </tr>
            </thead>

            <tbody>
              {referrals.map((ref) => (
                <tr key={ref.id} className="border-t border-gray-800">
                  <td className="p-3">{ref.referred_email}</td>
                  <td className="p-3">{ref.purchased_plan}</td>
                  <td className="p-3">{formatINR(ref.amount)}</td>
                  <td className="p-3 text-green-400">
                    {formatINR(ref.commission_amount)}
                  </td>
                  <td className="p-3">{ref.payment_status}</td>
                  <td className="p-3">
                    {ref.commissions?.[0]?.status || "pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}