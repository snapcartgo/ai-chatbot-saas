"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

type Domain = {
  id: string;
  domain: string;
  user_id: string;
};

export default function DomainsPage() {

  const params = useParams();
  const botId = params.id as string;

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {

    const { data, error } = await supabase
      .from("domains")
      .select("*")
      .eq("user_id", botId);

    if (error) {
      console.error(error);
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

  if (loading) {
    return <div style={{ padding: 40 }}>Loading domains...</div>;
  }

  return (
    <div style={{ padding: 40 }}>

      <h2>Allowed Domains</h2>

      {domains.length === 0 && <p>No domains found.</p>}

      {domains.map((d) => (
        <div
          key={d.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: 10,
            border: "1px solid #ddd",
            marginBottom: 10,
            maxWidth: 500
          }}
        >
          <span>{d.domain}</span>

          <button
            onClick={() => removeDomain(d.id)}
            style={{
              background: "red",
              color: "white",
              border: "none",
              padding: "4px 10px"
            }}
          >
            Remove
          </button>

        </div>
      ))}

    </div>
  );
}