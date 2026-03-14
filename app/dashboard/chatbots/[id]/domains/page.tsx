"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function DomainsPage() {

  const params = useParams();
  const botId = params.id as string;

  const [domains, setDomains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, [botId]);

  async function fetchDomains() {

    const { data, error } = await supabase
      .from("domains")
      .select("*")
      .eq("bot_id", botId);

    if (error) {
      console.error("Domain load error:", error);
      setLoading(false);
      return;
    }

    setDomains(data || []);
    setLoading(false);
  }

  async function removeDomain(id: string) {

    await supabase
      .from("domains")
      .delete()
      .eq("id", id);

    fetchDomains();
  }

  if (loading) return <p>Loading domains...</p>;

  return (
    <div style={{ padding: 40 }}>

      <h2>Allowed Domains</h2>

      {domains.length === 0 && (
        <p>No domains found.</p>
      )}

      {domains.map((d) => (
        <div
          key={d.id}
          style={{
            marginTop: 15,
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
              background: "red",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: 4
            }}
          >
            Remove
          </button>

        </div>
      ))}

    </div>
  );
}