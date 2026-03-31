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
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false); // mobile sidebar toggle

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
    <div className="flex min-h-screen bg-black">
      
      {/* 🔥 MOBILE MENU BUTTON */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-blue-600 text-white px-3 py-2 rounded"
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 🔥 SIDEBAR */}
      <aside
        className={`
          fixed md:static top-0 left-0 h-full w-64 bg-[#111] text-white border-r border-[#222] z-40
          transform ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 transition-transform duration-300
        `}
      >
        <Sidebar />
      </aside>

      {/* 🔥 MAIN CONTENT */}
      <main className="flex-1 flex flex-col w-full">
        
        {/* USER BAR */}
        <div className="p-4 md:p-6 border-b border-[#222] text-gray-400 text-sm bg-black">
          Logged in as: <span className="text-white">{userEmail}</span>
        </div>

        {/* PAGE CONTENT */}
        <div className="flex-1 p-4 md:p-6 bg-gray-100 text-black">
          {children}
        </div>
      </main>
    </div>
  );
}