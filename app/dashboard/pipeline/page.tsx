"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PipelinePage() {
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setLeads(data);
  }

  const columns = ["new", "contacted", "booked", "closed"];

  return (
    <div className="p-4 md:p-6 w-full">

      {/* TITLE */}
      <h1 className="text-xl md:text-2xl font-semibold mb-6">
        Lead Pipeline
      </h1>

      {/* 🔥 MOBILE SCROLL FIX */}
      <div className="overflow-x-auto">

        {/* GRID */}
        <div className="flex gap-4 min-w-[800px] md:grid md:grid-cols-4">

          {columns.map((status) => (
            <div
              key={status}
              className="bg-gray-100 p-3 rounded-lg min-h-[400px] w-[250px] md:w-auto"
            >

              {/* COLUMN TITLE */}
              <h3 className="mb-3 capitalize font-medium text-sm md:text-base">
                {status}
              </h3>

              {/* LEADS */}
              <div className="space-y-2">
                {leads
                  .filter(
                    (lead) =>
                      (lead.lead_status || "new") === status
                  )
                  .map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white p-3 rounded-md shadow-sm"
                    >
                      <div className="font-semibold text-sm">
                        {lead.name}
                      </div>

                      <div className="text-xs text-gray-600">
                        {lead.phone}
                      </div>

                      <div className="text-xs text-gray-500">
                        {lead.service}
                      </div>
                    </div>
                  ))}
              </div>

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}