"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();

      // ❌ not logged in
      if (!data.user) {
        router.push("/login");
        return;
      }

      // ✅ try to get user onboarding status
      const { data: userData, error } = await supabase
        .from("users")
        .select("onboarded")
        .eq("id", data.user.id)
        .single();

      // 👉 if no record OR error → treat as NEW user
      if (error || !userData) {
        router.push("/onboarding");
        return;
      }

      // ✅ existing user
      if (userData.onboarded) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    };

    checkUser();
  }, [router]);

  return <p>Loading...</p>;
}