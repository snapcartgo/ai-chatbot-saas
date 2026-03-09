"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Sidebar from "./sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {

    const checkUser = async () => {

      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        }}
      >
        <Sidebar />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "30px" }}>

        {/* Logged user */}
        <div style={{ marginBottom: "20px" }}>
          Logged in as: {userEmail}
        </div>

        {children}

      </div>

    </div>
  );
}