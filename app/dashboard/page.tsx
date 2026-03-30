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

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    
    // 1. Get the current logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // 2. Get ONLY the chatbots belonging to this user
    const { data: bots } = await supabase
      .from("chatbots")
      .select("id")
      .eq("user_id", user.id);

    const botIds = bots?.map((b) => b.id) || [];

    // If the user has no bots, everything should be 0
    if (botIds.length === 0) {
      setStats({ leads: 0, conversations: 0, bookings: 0 });
      setLoading(false);
      return;
    }

    // 3. Get Counts filtered by the user's Bot IDs
    const [leadsRes, convosRes, bookingsRes] = await Promise.all([
      // Count Leads for these bots
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("bot_id", botIds),

      // Count Messages/Conversations for these bots
      // Note: Use 'messages' table if that's where your chat data lives
      supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("bot_id", botIds),

      // Count Booked Leads for these bots
      supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .in("bot_id", botIds)
        .eq("lead_status", "booked")
    ]);

    setStats({
      leads: leadsRes.count || 0,
      conversations: convosRes.count || 0,
      bookings: bookingsRes.count || 0
    });
    
    setLoading(false);
  }

  const conversionRate =
    stats.leads > 0
      ? ((stats.bookings / stats.leads) * 100).toFixed(1)
      : "0.0";

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Dashboard
      </h1>

      {loading ? (
        <p className="text-gray-500 text-lg">Updating stats...</p>
      ) : (
        <div className="grid md:grid-cols-4 gap-6">
          <StatCard
            title="Total Leads"
            value={stats.leads}
            color="bg-blue-500"
          />

          <StatCard
            title="Conversations"
            value={stats.conversations}
            color="bg-purple-500"
          />

          <StatCard
            title="Bookings"
            value={stats.bookings}
            color="bg-green-500"
          />

          <StatCard
            title="Conversion Rate"
            value={conversionRate + "%"}
            color="bg-orange-500"
          />
        </div>
      )}
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
    <div className={`p-6 rounded-xl text-white shadow-lg ${color}`}>
      <div className="text-sm opacity-80">
        {title}
      </div>
      <div className="text-3xl font-bold mt-2">
        {value}
      </div>
    </div>
  );
}