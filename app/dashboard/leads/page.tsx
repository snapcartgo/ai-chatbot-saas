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
    const headers = ["Name", "Phone", "Service", "Budget", "Status"];

    const rows = filteredLeads.map((lead) => [
      lead.name,
      lead.phone,
      lead.service,
      lead.budget,
      lead.lead_status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "leads.csv";
    link.click();
  }

  return (
    <div className="p-4 md:p-6 w-full">

      {/* TITLE */}
      <h1 className="text-xl md:text-2xl font-semibold mb-4">
        Leads CRM
      </h1>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">

        <input
          placeholder="Search name or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-[250px] border rounded px-3 py-2"
        />

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full md:w-[200px] border rounded px-3 py-2"
        >
          <option value="all">All Leads</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="booked">Booked</option>
          <option value="closed">Closed</option>
        </select>

        <button
          onClick={exportCSV}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full md:w-auto"
        >
          Export CSV
        </button>

      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full border">

          <thead className="bg-black text-white text-sm">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Phone</th>
              <th className="p-3 text-left">Service</th>
              <th className="p-3 text-left">Budget</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Chat</th>
            </tr>
          </thead>

          <tbody>
            {filteredLeads.map((lead: any) => (
              <tr key={lead.id} className="border-b">

                {/* NAME */}
                <td className="p-3">
                  <button
                    onClick={() =>
                      (window.location.href = `/dashboard/leads/${lead.id}`)
                    }
                    className="text-blue-600 underline font-medium"
                  >
                    {lead.name}
                  </button>
                </td>

                <td className="p-3">{lead.phone}</td>
                <td className="p-3">{lead.service}</td>
                <td className="p-3">{lead.budget}</td>

                {/* STATUS */}
                <td className="p-3">
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
                    className="border rounded px-2 py-1 bg-white text-black"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="booked">Booked</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>

                {/* CHAT */}
                <td className="p-3">
                  <a
                    href={`/dashboard/conversations?conversation=${lead.conversation_id}`}
                    className="text-blue-600"
                  >
                    View Chat
                  </a>
                </td>

              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </div>
  );
}