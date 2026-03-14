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

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {

    // Get logged in user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("domains")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
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
      console.error(error);
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
        <p>No domains found.</p>
      )}

      {domains.map((d) => (

        <div
          key={d.id}
          style={{
            marginBottom: 10,
            padding: 10,
            border: "1px solid #ddd",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
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
              padding: "5px 12px",
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