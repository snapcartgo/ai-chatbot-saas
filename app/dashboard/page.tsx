"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Sentry from "@sentry/nextjs";

export default function DashboardPage() {
  // --- Dashboard Stats State ---
  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [botIds, setBotIds] = useState<string[]>([]);

  // --- Calendar Sync State ---
  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");
  const [activeCalendar, setActiveCalendar] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ text: "", type: "" });

  // --- WhatsApp Test State ---
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from your AI Agent!");
  const [selectedBotId, setSelectedBotId] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    initDashboard();
  }, []);

  // --- Referral Logic ---
  async function attachReferralFromStorage(user: any) {
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
          ref: ref,
        }),
      });

      if (res.ok) localStorage.removeItem("referral");
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  // --- Initialization Logic ---
  async function initDashboard() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.id || !user?.email) {
      setLoading(false);
      return;
    }

    await Promise.all([
      supabase.from("profiles").upsert({
        id: user.id,
        email: user.email?.toLowerCase(),
      }),
      attachReferralFromStorage(user),
    ]);

    const [calRes, botsRes] = await Promise.all([
      supabase.from("client_calendars").select("calendar_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("chatbots").select("id").eq("user_id", user.id),
    ]);

    if (calRes.data) setActiveCalendar(calRes.data.calendar_id);
    
    const fetchedBotIds = botsRes.data?.map((b: any) => b.id) || [];
    setBotIds(fetchedBotIds);
    if (fetchedBotIds.length > 0) setSelectedBotId(fetchedBotIds[0]);

    const [leadsRes, bookingsRes] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("payment_status", "paid"),
    ]);

    const convosRes = fetchedBotIds.length > 0
      ? await supabase.from("messages").select("*", { count: "exact", head: true }).in("bot_id", fetchedBotIds)
      : { count: 0 };

    setStats({
      leads: leadsRes.count || 0,
      conversations: convosRes.count || 0,
      bookings: bookingsRes.count || 0,
    });

    setLoading(false);
  }

  // --- Event Handlers ---
  async function handleCalendarSync(e: React.FormEvent) {
    e.preventDefault();
    setSyncLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("client_calendars").upsert(
      { calendar_id: calendarId, client_name: clientName, user_id: user.id, status: "pending" },
      { onConflict: "user_id" }
    );

    if (error) setSyncMessage({ text: error.message, type: "error" });
    else {
      setSyncMessage({ text: "Success! Calendar synced.", type: "success" });
      setActiveCalendar(calendarId);
    }
    setSyncLoading(false);
  }

  async function handleWhatsAppTest(e: React.FormEvent) {
  e.preventDefault();
  setIsTesting(true);

  // Get the logged-in user's ID
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user?.id, // Send the USER ID here
        message: testMessage,
        recipient_phone: testPhone,
      }),
    });

    if (res.ok) alert("Test Sent!");
    else alert("Check console for errors.");
  } catch (err) {
    alert("Network error.");
  } finally {
    setIsTesting(false);
  }
}

  const conversionRate = stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : "0.0";

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar Sync Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">Calendar Sync</h2>
            <form onSubmit={handleCalendarSync} className="space-y-4">
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client Name" className="w-full border rounded-lg p-3" required />
              <input value={calendarId} onChange={(e) => setCalendarId(e.target.value)} placeholder="Calendar ID" className="w-full border rounded-lg p-3" required />
              <button disabled={syncLoading} className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold">
                {syncLoading ? "Syncing..." : "Sync Calendar"}
              </button>
            </form>
          </div>

          {/* WhatsApp Test Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">WhatsApp Quick Test</h2>
            <form onSubmit={handleWhatsAppTest} className="space-y-4">
              <select className="w-full border rounded-lg p-3" value={selectedBotId} onChange={(e) => setSelectedBotId(e.target.value)}>
                {botIds.map(id => <option key={id} value={id}>Bot ID: {id.slice(0, 8)}</option>)}
              </select>
              <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Phone (e.g. 919876543210)" className="w-full border rounded-lg p-3" required />
              <textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} className="w-full border rounded-lg p-3 h-20" placeholder="Message text..." />
              <button disabled={isTesting} className="w-full bg-green-600 text-white rounded-lg p-3 font-semibold">
                {isTesting ? "Sending..." : "Send Test WhatsApp"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, color, href }: any) {
  return (
    <Link href={href} className={`block p-6 rounded-2xl text-white shadow-sm transition-transform hover:scale-[1.02] ${color}`}>
      <div className="text-xs font-bold uppercase opacity-70 tracking-wider">{title}</div>
      <div className="text-4xl font-extrabold mt-2 tracking-tight">{value}</div>
    </Link>
  );
}