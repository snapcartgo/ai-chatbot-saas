"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0
  });
  const [loading, setLoading] = useState(true);

  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");
  const [activeCalendar, setActiveCalendar] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    initDashboard();
  }, []);

  // ✅ MAIN INIT FUNCTION
  async function initDashboard() {
    setLoading(true);

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // 🔥 IMPORTANT: USER SYNC (THIS WAS MISSING)
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email?.toLowerCase(),
    });

    // ---------------- EXISTING CODE ----------------

    const { data: calData } = await supabase
      .from("client_calendars")
      .select("calendar_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (calData) {
      setActiveCalendar(calData.calendar_id);
    }

    const { data: bots } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id);

    const botIds = bots?.map((b) => b.id) || [];

    const leadsPromise = supabase
      .from("leads")
      .select("*", { count: "exact", head: true });

    const bookingsPromise = supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("payment_status", "paid");

    const conversationsPromise =
      botIds.length > 0
        ? supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("bot_id", botIds)
        : Promise.resolve({ count: 0 });

    const [leadsRes, bookingsRes, convosRes] = await Promise.all([
      leadsPromise,
      bookingsPromise,
      conversationsPromise
    ]);

    setStats({
      leads: leadsRes.count || 0,
      conversations: convosRes.count || 0,
      bookings: bookingsRes.count || 0
    });

    setLoading(false);
  }

  async function handleCalendarSync(e: React.FormEvent) {
    e.preventDefault();
    setSyncLoading(true);
    setSyncMessage({ text: "", type: "" });

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      setSyncMessage({ text: "Please log in first.", type: "error" });
      setSyncLoading(false);
      return;
    }

    const { error } = await supabase.from("client_calendars").upsert(
      {
        calendar_id: calendarId,
        client_name: clientName,
        user_id: user.id,
        status: "pending"
      },
      { onConflict: "user_id" }
    );

    if (error) {
      setSyncMessage({ text: `Error: ${error.message}`, type: "error" });
    } else {
      setSyncMessage({ text: "Success! Calendar synced.", type: "success" });
      setActiveCalendar(calendarId);
      setCalendarId("");
      setClientName("");
    }

    setSyncLoading(false);
  }

  const conversionRate =
    stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Agency Dashboard</h1>

        {loading ? (
          <p className="text-gray-500 text-lg animate-pulse">Updating stats...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard title="Total Leads" value={stats.leads} color="bg-blue-600" href="/dashboard/leads" />
            <StatCard title="Conversations" value={stats.conversations} color="bg-purple-600" href="/dashboard/conversations" />
            <StatCard title="Orders" value={stats.bookings} color="bg-green-600" href="/dashboard/orders" />
            <StatCard title="Conversion Rate" value={`${conversionRate}%`} color="bg-orange-600" href="/dashboard/pipeline" />
          </div>
        )}

        {/* Your existing calendar UI stays same */}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  color,
  href
}: {
  title: string;
  value: React.ReactNode;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block p-6 rounded-2xl text-white shadow-sm transition-transform hover:scale-[1.02] ${color}`}
    >
      <div className="text-xs font-bold uppercase opacity-70 tracking-wider">{title}</div>
      <div className="text-4xl font-extrabold mt-2 tracking-tight">{value}</div>
    </Link>
  );
}