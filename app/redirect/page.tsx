"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const urlRef = params.get("referred_by");
      const storedRef = localStorage.getItem("referral");
      const finalRefCode = urlRef || storedRef;

      // 1. Attach referral properly using backend API
      if (finalRefCode && user.email) {
        try {
          await fetch("/api/referrals/attach", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.email.toLowerCase(),
              ref: finalRefCode,
            }),
          });

          localStorage.removeItem("referral");
        } catch (err) {
          console.error("Referral attach failed:", err);
        }
      }

      // 2. Check if this user is actually a partner
      const { data: partnerData, error: partnerError } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (partnerError) {
        console.error("Partner lookup error:", partnerError);
      }

      // 3. Check onboarding state from users table
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle();

      // 4. Real routing logic
      if (partnerData?.id) {
        router.push("/partner-dashboard");
        return;
      }

      if (!userData || userError) {
        router.push("/onboarding");
        return;
      }

      if (userData.onboarded) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    };

    handleRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-lg font-medium">Syncing your account...</p>
    </div>
  );
}
