"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LogoutButton() {

  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-4 py-3 text-red-400 hover:bg-gray-800 rounded-lg"
    >
      Logout
    </button>
  );
}