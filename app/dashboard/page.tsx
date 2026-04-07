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

  // Calendar Sync States
  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");
  const [activeCalendar, setActiveCalendar] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    // ✅ Get Calendar
    const { data: calData } = await supabase
      .from("client_calendars")
      .select("calendar_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (calData) {
      setActiveCalendar(calData.calendar_id);
    }

    // ✅ FETCH STATS (FIXED — NO BOT FILTER)
    const [leadsRes, convosRes, bookingsRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),

      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),

      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("lead_status", "booked")
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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSyncMessage({ text: "Please log in first.", type: "error" });
      setSyncLoading(false);
      return;
    }

    const { error } = await supabase
      .from("client_calendars")
      .upsert(
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
    stats.leads > 0
      ? ((stats.bookings / stats.leads) * 100).toFixed(1)
      : "0.0";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Agency Dashboard
        </h1>

        {/* Stats */}
        {loading ? (
          <p className="text-gray-500 text-lg animate-pulse">
            Updating stats...
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard title="Total Leads" value={stats.leads} color="bg-blue-600" />
            <StatCard title="Conversations" value={stats.conversations} color="bg-purple-600" />
            <StatCard title="Bookings" value={stats.bookings} color="bg-green-600" />
            <StatCard title="Conversion Rate" value={conversionRate + "%"} color="bg-orange-600" />
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-2xl">
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Calendar Configuration</h2>
              <p className="text-sm text-gray-500">
                Manage the Google Calendar pulled into your main view.
              </p>
            </div>

            {activeCalendar && (
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                Linked
              </span>
            )}
          </div>

          {activeCalendar ? (
            <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
                Active Calendar ID
              </div>
              <div className="text-lg font-mono font-bold text-blue-600 truncate">
                {activeCalendar}
              </div>

              <button
                onClick={() => setActiveCalendar(null)}
                className="mt-4 text-sm font-medium text-gray-600 hover:text-red-500"
              >
                Change Calendar Settings
              </button>
            </div>
          ) : (
            <form onSubmit={handleCalendarSync} className="space-y-4">
              <input
                type="text"
                placeholder="Customer Name"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="p-2 border w-full rounded"
              />

              <input
                type="email"
                placeholder="Calendar Email"
                required
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                className="p-2 border w-full rounded"
              />

              <button
                type="submit"
                disabled={syncLoading}
                className="bg-black text-white px-6 py-2 rounded"
              >
                {syncLoading ? "Saving..." : "Sync Calendar"}
              </button>
            </form>
          )}

          {syncMessage.text && (
            <p
              className={`mt-3 ${
                syncMessage.type === "error"
                  ? "text-red-500"
                  : "text-green-600"
              }`}
            >
              {syncMessage.text}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  color
}: {
  title: string;
  value: any;
  color: string;
}) {
  return (
    <div className={`p-6 rounded-2xl text-white ${color}`}>
      <div className="text-xs uppercase opacity-70">{title}</div>
      <div className="text-4xl font-bold mt-2">{value}</div>
    </div>
  );
}