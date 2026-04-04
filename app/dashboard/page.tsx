"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0
  });
  const [loading, setLoading] = useState(true);

  // New states for Calendar Sync
  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: bots } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id);

    const botIds = bots?.map((b) => b.id) || [];

    if (botIds.length === 0) {
      setStats({ leads: 0, conversations: 0, bookings: 0 });
      setLoading(false);
      return;
    }

    const [leadsRes, convosRes, bookingsRes] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }).in("bot_id", botIds),
      supabase.from("messages").select("*", { count: "exact", head: true }).in("bot_id", botIds),
      supabase.from("leads").select("*", { count: "exact", head: true }).in("bot_id", botIds).eq("lead_status", "booked")
    ]);

    setStats({
      leads: leadsRes.count || 0,
      conversations: convosRes.count || 0,
      bookings: bookingsRes.count || 0
    });
    
    setLoading(false);
  }

  // --- New Calendar Sync Function ---
  async function handleCalendarSync(e: React.FormEvent) {
    e.preventDefault();
    setSyncLoading(true);
    setSyncMessage({ text: "", type: "" });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSyncMessage({ text: "Please log in first.", type: "error" });
      setSyncLoading(false);
      return;
    }

    const { error } = await supabase
      .from("client_calendars")
      .insert([
        { 
          calendar_id: calendarId, 
          client_name: clientName, 
          user_id: user.id,
          status: 'pending' 
        }
      ]);

    if (error) {
      setSyncMessage({ text: `Error: ${error.message}`, type: "error" });
    } else {
      setSyncMessage({ text: "Success! Calendar added to sync queue.", type: "success" });
      setCalendarId("");
      setClientName("");
    }
    setSyncLoading(false);
  }

  const conversionRate = stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Agency Dashboard</h1>

        {/* Stats Grid */}
        {loading ? (
          <p className="text-gray-500 text-lg animate-pulse">Updating stats...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard title="Total Leads" value={stats.leads} color="bg-blue-600" />
            <StatCard title="Conversations" value={stats.conversations} color="bg-purple-600" />
            <StatCard title="Bookings" value={stats.bookings} color="bg-green-600" />
            <StatCard title="Conversion Rate" value={conversionRate + "%"} color="bg-orange-600" />
          </div>
        )}

        {/* Calendar Sync Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">Add Customer Calendar</h2>
            <p className="text-sm text-gray-500">Automatically sync a customer's shared calendar to your main view.</p>
          </div>

          <form onSubmit={handleCalendarSync} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 uppercase">Customer Name</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="e.g. Azaadi Band"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 uppercase">Calendar Email ID</label>
                <input
                  type="email"
                  required
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="customer@gmail.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={syncLoading}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 transition"
            >
              {syncLoading ? "Processing..." : "Sync Calendar"}
            </button>

            {syncMessage.text && (
              <p className={`text-sm mt-2 font-medium ${syncMessage.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {syncMessage.text}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function StatCard({ title, value, color }: { title: string; value: any; color: string }) {
  return (
    <div className={`p-6 rounded-2xl text-white shadow-sm transition-transform hover:scale-[1.02] ${color}`}>
      <div className="text-xs font-bold uppercase opacity-70 tracking-wider">{title}</div>
      <div className="text-4xl font-extrabold mt-2 tracking-tight">{value}</div>
    </div>
  );
}