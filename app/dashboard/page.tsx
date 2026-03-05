"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {

  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0
  });

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
      bookings: bookings || 0
    });

  }

  const conversionRate =
    stats.leads > 0
      ? ((stats.bookings / stats.leads) * 100).toFixed(1)
      : 0;

  return (

    <main className="min-h-screen bg-gray-100 p-8">

      <h1 className="text-3xl font-bold text-gray-800 mb-8">
        Dashboard
      </h1>

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