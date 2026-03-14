"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Domain = {
  id: string;
  domain: string;
  user_id: string;
  created_at: string;
};

export default function DomainsPage() {

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  // Replace with dynamic botId later
  const botId = "YOUR_BOT_ID";

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {

    const { data, error } = await supabase
      .from("domains")
      .select("*")
      .eq("user_id", botId);

    if (error) {
      console.error("Error fetching domains:", error);
      return;
    }

    setDomains(data || []);
    setLoading(false);

  }

  async function removeDomain(id: string) {

    const { error } = await supabase
      .from("domains")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting domain:", error);
      return;
    }

    fetchDomains();

  }

  if (loading) {
    return <div style={{ padding: 40 }}>Loading domains...</div>;
  }

  return (

    <div style={{ padding: 40 }}>

      <h2>Allowed Domains</h2>

      {domains.length === 0 && (
        <p>No domains added yet.</p>
      )}

      {domains.map((d) => (

        <div
          key={d.id}
          style={{
            marginBottom: 12,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            maxWidth: 400
          }}
        >

          <span>{d.domain}</span>

          <button
            onClick={() => removeDomain(d.id)}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              padding: "4px 10px",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Remove
          </button>

        </div>

      ))}

    </div>

  );

}