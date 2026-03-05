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

    <div style={{ padding: "30px" }}>

      <h1 style={{ fontSize: "26px", marginBottom: "25px" }}>
        Lead Pipeline
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px"
        }}
      >

        {columns.map((status) => (

          <div
            key={status}
            style={{
              background: "#f3f4f6",
              padding: "15px",
              borderRadius: "10px",
              minHeight: "400px"
            }}
          >

            <h3
              style={{
                marginBottom: "15px",
                textTransform: "capitalize"
              }}
            >
              {status}
            </h3>

            {leads
              .filter((lead) => (lead.lead_status || "new") === status)
              .map((lead) => (

                <div
                  key={lead.id}
                  style={{
                    background: "#ffffff",
                    padding: "10px",
                    borderRadius: "8px",
                    marginBottom: "10px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                >

                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "4px"
                    }}
                  >
                    {lead.name}
                  </div>

                  <div style={{ fontSize: "13px" }}>
                    {lead.phone}
                  </div>

                  <div style={{ fontSize: "12px", color: "#555" }}>
                    {lead.service}
                  </div>

                </div>

              ))}

          </div>

        ))}

      </div>

    </div>

  );

}