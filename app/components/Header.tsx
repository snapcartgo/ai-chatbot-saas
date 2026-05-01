"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data, error } = await supabase
          .from("partners")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(); // ✅ safer

        setIsPartner(!!data && !error);
      } else {
        setIsPartner(false);
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const { data } = await supabase
            .from("partners")
            .select("id")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          setIsPartner(!!data);
        } else {
          setIsPartner(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "15px 40px",
      backgroundColor: "#000",
      borderBottom: "1px solid #222",
      color: "white"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
        <Link href="/" style={{ color: "#3b82f6", fontWeight: "bold", textDecoration: "none", fontSize: "1.2rem" }}>
          AI Chatbot SaaS
        </Link>

        <div style={{ display: "flex", gap: "20px", fontSize: "14px" }}>
          <Link href="/" style={{ color: "#ccc", textDecoration: "none" }}>
            Home
          </Link>

          {/* ✅ Show only if partner */}
          {!loading && isPartner && (
            <Link
              href="/partner-dashboard"
              style={{
                color: "#3b82f6",
                fontWeight: "600",
                textDecoration: "none",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                padding: "4px 12px",
                borderRadius: "6px"
              }}
            >
              Partner Dashboard
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        {!loading && (
          user ? (
            <button
              onClick={handleLogout}
              style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" }}
            >
              Logout
            </button>
          ) : (
            <Link href="/login" style={{ color: "white", textDecoration: "none", fontSize: "14px" }}>
              Login
            </Link>
          )
        )}
      </div>
    </nav>
  );
}