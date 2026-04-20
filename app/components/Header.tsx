"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [isPartner, setIsPartner] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setUser(authUser ?? null);

      if (!authUser) {
        setIsPartner(false);
        return;
      }

      const { data: partnerData, error } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      setIsPartner(!error && !!partnerData);
    };

    checkStatus();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);

        if (!session?.user) {
          setIsPartner(false);
          return;
        }

        const { data: partnerData, error } = await supabase
          .from("partners")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setIsPartner(!error && !!partnerData);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsPartner(false);
    router.push("/");
  };

  const linkStyle: React.CSSProperties = {
    color: "#ccc",
    textDecoration: "none",
    fontSize: "14px",
  };

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "15px 40px",
        backgroundColor: "#000",
        borderBottom: "1px solid #222",
        color: "white",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
        <Link
          href="/"
          style={{
            color: "#3b82f6",
            fontWeight: "bold",
            textDecoration: "none",
            fontSize: "1.2rem",
          }}
        >
          AI Chatbot SaaS
        </Link>

        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <Link href="/" style={linkStyle}>
            Home
          </Link>

          <Link href="/blog" style={linkStyle}>
            Blog
          </Link>

          {isPartner && (
            <Link
              href="/partner-dashboard"
              style={{
                color: "#3b82f6",
                fontWeight: 600,
                textDecoration: "none",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                padding: "4px 12px",
                borderRadius: "6px",
                fontSize: "14px",
              }}
            >
              Partner Dashboard
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        {user ? (
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Logout
          </button>
        ) : (
          <Link
            href="/login"
            style={{ color: "white", textDecoration: "none", fontSize: "14px" }}
          >
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
