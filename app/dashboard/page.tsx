"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Separate component to handle search params safely in Next.js
function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0,
  });

  useEffect(() => {
    // 1. Check for payment success in URL
    if (searchParams.get("payment") === "success") {
      setShowSuccess(true);
      // Clean up the URL so the message doesn't reappear on refresh
      const timeout = setTimeout(() => {
        router.replace("/dashboard");
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [searchParams, router]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const { count: leads } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true });

    const { count: conversations } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });

    const { count: bookings } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("lead_status", "booked");

    setStats({
      leads: leads || 0,
      conversations: conversations || 0,
      bookings: bookings || 0,
    });
  }

  const conversionRate =
    stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : 0;

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      {/* ✅ SUCCESS MESSAGE ALERT */}
      {showSuccess && (
        <div className="mb-8 p-4 bg-green-500 text-white rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div>
              <p className="font-bold text-lg">Payment Successful!</p>
              <p className="text-sm opacity-90">Your account has been updated and your plan is now active.</p>
            </div>
          </div>
          <button onClick={() => setShowSuccess(false)} className="hover:bg-white/10 p-1 rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      )}

      <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

      <div className="grid md:grid-cols-4 gap-6">
        <StatCard title="Total Leads" value={stats.leads} color="bg-blue-500" />
        <StatCard title="Conversations" value={stats.conversations} color="bg-purple-500" />
        <StatCard title="Bookings" value={stats.bookings} color="bg-green-500" />
        <StatCard title="Conversion Rate" value={conversionRate + "%"} color="bg-orange-500" />
      </div>
    </main>
  );
}

// Main Page Component with Suspense Boundary (Required for useSearchParams in Next.js)
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function StatCard({ title, value, color }: { title: string; value: any; color: string }) {
  return (
    <div className={`p-6 rounded-xl text-white shadow-lg ${color}`}>
      <div className="text-sm opacity-80">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}