"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email ?? null);
      }
    };

    checkUser();
  }, [router]);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      
      {/* Sidebar */}
      <div
        style={{
          width: "240px",
          background: "#111",
          color: "#fff",
          padding: "20px",
        }}
      >
        <h2>AI Chatbot SaaS</h2>
        <hr />

        <p><a href="/dashboard" style={{ color: "#fff" }}>Dashboard</a></p>

        <p><a href="/dashboard/chatbots" style={{ color: "#fff" }}>Chatbots</a></p>

        <p><a href="/dashboard/conversations" style={{ color: "#fff" }}>Conversations</a></p>

        <p><a href="/dashboard/leads" style={{ color: "#fff" }}>Leads</a></p>
        <a href="/dashboard/pipeline">Pipeline</a>
      </div>
      {/* Main Content */}
      <div style={{ flex: 1, padding: "30px" }}>
        <div style={{ marginBottom: "20px" }}>
          Logged in as: {userEmail}
        </div>
        {children}
      </div>

    </div>
  );
}