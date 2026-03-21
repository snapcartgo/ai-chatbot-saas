"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "./sidebar"; // Ensure sidebar.tsx exists in app/dashboard/

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
      } else {
        setUserEmail(user.email ?? null);
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#000000" }}>
      {/* Sidebar - Fixed width */}
      <aside
        style={{
          width: "240px",
          background: "#111",
          color: "#fff",
          borderRight: "1px solid #222",
        }}
      >
        <Sidebar />
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* User Status Bar */}
        <div 
          style={{ 
            padding: "15px 30px", 
            borderBottom: "1px solid #222", 
            color: "#888",
            fontSize: "14px",
            backgroundColor: "#000"
          }}
        >
          Logged in as: <span style={{ color: "#fff" }}>{userEmail}</span>
        </div>

        {/* Dynamic Page Content */}
        <div style={{ flex: 1, padding: "30px", backgroundColor: "#f9f9f9", color: "#000" }}>
          {children}
        </div>
      </main>
    </div>
  );
}