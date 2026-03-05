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

    <div style={{ padding: "30px" }}>

      <h1 style={{ fontSize: "28px", marginBottom: "25px" }}>
        Dashboard
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px"
        }}
      >

        <StatCard title="Total Leads" value={stats.leads} />

        <StatCard title="Conversations" value={stats.conversations} />

        <StatCard title="Bookings" value={stats.bookings} />

        <StatCard
          title="Conversion Rate"
          value={conversionRate + "%"}
        />

      </div>

    </div>

  );
}

function StatCard({
  title,
  value
}: {
  title: string;
  value: any;
}) {

  return (

    <div
      style={{
        background: "#111",
        color: "#fff",
        padding: "25px",
        borderRadius: "10px"
      }}
    >

      <div style={{ fontSize: "14px", opacity: 0.8 }}>
        {title}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          marginTop: "8px"
        }}
      >
        {value}
      </div>

    </div>

  );

}