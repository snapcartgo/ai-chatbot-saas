"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Sentry from "@sentry/nextjs";
import WhatsAppSetupButton from "../components/WhatsAppSetupButton";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    async function initDashboard() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !user?.email) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      await Promise.all([
        supabase.from("profiles").upsert({
          id: user.id,
          email: user.email?.toLowerCase(),
        }),
        attachReferralFromStorage(user),
      ]);

      const [calRes, botsRes] = await Promise.all([
        supabase
          .from("client_calendars")
          .select("calendar_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("chatbots").select("id").eq("user_id", user.id),
      ]);

      const fetchedBotIds =
        botsRes.data?.map((b: { id: string }) => b.id) || [];

      const [leadsRes, bookingsRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("payment_status", "paid"),
      ]);

      const convosRes =
        fetchedBotIds.length > 0
          ? await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .in("bot_id", fetchedBotIds)
          : { count: 0 };

      setStats({
        leads: leadsRes.count || 0,
        conversations: convosRes.count || 0,
        bookings: bookingsRes.count || 0,
      });

      setLoading(false);
    }

    initDashboard();
  }, []);

  async function attachReferralFromStorage(user: {
    id?: string;
    email?: string | null;
  }) {
    try {
      const params = new URLSearchParams(window.location.search);
      const refFromUrl = params.get("ref");
      const refFromStorage = localStorage.getItem("referral");
      const ref = refFromUrl || refFromStorage;

      if (!ref || !user?.id || !user?.email) return;

      const res = await fetch("/api/referrals/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email.toLowerCase(),
          ref,
        }),
      });

      if (res.ok) localStorage.removeItem("referral");
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  async function handleCalendarSync(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const { error } = await supabase.from("client_calendars").upsert(
      {
        calendar_id: calendarId,
        client_name: clientName,
        user_id: userId,
        status: "pending",
      },
      { onConflict: "user_id" }
    );

    if (error) {
      alert(error.message);
    } else {
      alert("Success! Calendar synced.");
    }
  }

  const conversionRate =
    stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Agency Dashboard
        </h1>

        {loading ? (
          <p className="text-gray-500 text-lg animate-pulse">
            Updating stats...
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard
              title="Total Leads"
              value={stats.leads}
              color="bg-blue-600"
              href="/dashboard/leads"
            />
            <StatCard
              title="Conversations"
              value={stats.conversations}
              color="bg-purple-600"
              href="/dashboard/conversations"
            />
            <StatCard
              title="Orders"
              value={stats.bookings}
              color="bg-green-600"
              href="/dashboard/orders"
            />
            <StatCard
              title="Conversion Rate"
              value={`${conversionRate}%`}
              color="bg-orange-600"
              href="/dashboard/pipeline"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Calendar Sync</h2>
            <form onSubmit={handleCalendarSync} className="space-y-4">
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client Name"
                className="w-full border rounded-lg p-3 text-gray-900 bg-white"
                required
              />
              <input
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="Calendar ID"
                className="w-full border rounded-lg p-3 text-gray-900 bg-white"
                required
              />
              <button className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700 transition-colors">
                Sync Calendar
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            <h2 className="text-xl font-bold mb-2 text-gray-800">
              WhatsApp Onboarding
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Connect your official Meta WhatsApp Business Account to enable
              automated AI messaging.
            </p>

            <div className="mt-auto">
              {userId ? (
                <WhatsAppSetupButton clientId={userId} />
              ) : (
                <div className="h-12 w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400 text-sm">
                  Loading user session...
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-3 text-center">
                Requires Meta Business Verification for full message volume.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  color,
  href,
}: {
  title: string;
  value: string | number;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block p-6 rounded-2xl text-white shadow-sm transition-transform hover:scale-[1.02] ${color}`}
    >
      <div className="text-xs font-bold uppercase opacity-70 tracking-wider">
        {title}
      </div>
      <div className="text-4xl font-extrabold mt-2 tracking-tight">
        {value}
      </div>
    </Link>
  );
}