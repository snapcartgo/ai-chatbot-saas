"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LeadsPage() {

  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data);
    }

  }

  const filteredLeads = leads.filter((lead: any) => {

    const matchesSearch =
      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.includes(search);

    const matchesFilter =
      filter === "all" || lead.lead_status === filter;

    return matchesSearch && matchesFilter;

  });

  function exportCSV() {

    const headers = [
      "Name",
      "Phone",
      "Service",
      "Budget",
      "Status"
    ];

    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.phone,
      lead.service,
      lead.budget,
      lead.lead_status
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((e) => e.join(","))
        .join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "leads.csv";
    link.click();

  }

  return (

    <div style={{ padding: "30px" }}>

      <h1 style={{ fontSize: "26px", marginBottom: "20px" }}>
        Leads CRM
      </h1>

      {/* Controls */}
      <div style={{
        display: "flex",
        gap: "15px",
        marginBottom: "20px"
      }}>

        <input
          placeholder="Search name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            width: "250px"
          }}
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: "8px",
            border: "1px solid #050505",
            borderRadius: "5px"
          }}
        >
          <option value="all">All Leads</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="booked">Booked</option>
          <option value="closed">Closed</option>
        </select>

        <button
          onClick={exportCSV}
          style={{
            padding: "8px 14px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Export CSV
        </button>

      </div>

      {/* Leads Table */}

      <table style={{
        width: "100%",
        borderCollapse: "collapse"
      }}>

        <thead>

          <tr style={{
            background: "#111",
            color: "#fff"
          }}>

            <th style={{ padding: "12px", textAlign: "left" }}>Name</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Phone</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Service</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Budget</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Chat</th>

          </tr>

        </thead>

        <tbody>

          {filteredLeads.map((lead: any) => (

            <tr
              key={lead.id}
              style={{
                borderBottom: "1px solid #ddd"
              }}
            >

              {/* Clickable Name */}

              <td style={{ padding: "12px" }}>

                <button
                  onClick={() =>
                    window.location.href = `/dashboard/leads/${lead.id}`
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontWeight: "bold",
                    padding: 0
                  }}
                >
                  {lead.name}
                </button>

              </td>

              <td style={{ padding: "12px" }}>
                {lead.phone}
              </td>

              <td style={{ padding: "12px" }}>
                {lead.service}
              </td>

              <td style={{ padding: "12px" }}>
                {lead.budget}
              </td>

              {/* Status Dropdown */}

              <td style={{ padding: "12px" }}>

                <select
                value={lead.lead_status || "new"}
                onChange={async (e) => {

                    const status = e.target.value;

                    await supabase
                    .from("leads")
                    .update({ lead_status: status })
                    .eq("id", lead.id);

                    setLeads((prev) =>
                    prev.map((l: any) =>
                        l.id === lead.id
                        ? { ...l, lead_status: status }
                        : l
                    )
                    );

                }}

                style={{
                    padding: "6px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    fontWeight: "500",
                    opacity: 1
                }}
                >

                <option value="new" style={{ color: "#000" }}>New</option>
                <option value="contacted" style={{ color: "#000" }}>Contacted</option>
                <option value="booked" style={{ color: "#000" }}>Booked</option>
                <option value="closed" style={{ color: "#000" }}>Closed</option>

                </select>

              </td>

              {/* Chat */}

              <td style={{ padding: "12px" }}>

                <a
                  href={`/dashboard/conversations?conversation=${lead.conversation_id}`}
                  style={{
                    color: "#2563eb"
                  }}
                >
                  View Chat
                </a>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}