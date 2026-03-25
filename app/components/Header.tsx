"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [isPartner, setIsPartner] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      // 1. Get the current logged-in user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        // 2. CRITICAL: Only set isPartner to true if they exist in your partners table
        const { data: partnerData } = await supabase
          .from("partners")
          .select("id")
          .eq("user_id", authUser.id)
          .single();
        
        if (partnerData) {
          setIsPartner(true);
        } else {
          setIsPartner(false);
        }
      }
    };

    checkStatus();

    // 3. Listen for login/logout to refresh the header automatically
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setIsPartner(false);
      } else {
        checkStatus(); // Re-check partner status on login
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
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
          <Link href="/" style={{ color: "#ccc", textDecoration: "none" }}>Home</Link>
          
          {/* ✅ ONLY show if the user is a verified partner */}
          {isPartner && (
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
        {user ? (
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
        )}
      </div>
    </nav>
  );
}