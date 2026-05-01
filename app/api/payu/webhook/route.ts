import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase with Service Role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Parse the request body
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // Extract fields from PayU request
    const status = String(data.status || "").toLowerCase();
    const email = String(data.email || data.udf1 || "").toLowerCase().trim();
    const productinfo = String(data.productinfo || data.udf2 || "").toLowerCase();
    const txnid = String(data.txnid || "");

    // Check Payment Status
    if (status !== "success") {
      console.log("❌ Payment failed or pending for:", email);
      return NextResponse.json({ success: false, message: "Payment not successful" });
    }

    // 2. THE FIX: Use .eq() instead of .ilike() for an instant search
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email) 
      .single();

    if (profileError || !profile?.id) {
      console.error("❌ Profile NOT FOUND in Supabase for email:", email);
      return NextResponse.json({ success: false, message: "User profile not found" }, { status: 404 });
    }

    console.log("✅ Found User Profile ID:", profile.id);

    // 3. Logic Branch: WhatsApp vs. Website Chatbot
    if (productinfo.includes("whatsapp")) {
      console.log("🚀 Processing WhatsApp Subscription...");

      // Use Promise.all to run these updates at the same time so the server doesn't wait twice
      await Promise.all([
        supabase.from("whatsapp_subscriptions").upsert({
          user_id: profile.id,
          status: "active",
          plan: "whatsapp_automation",
          message_limit: 1000,
          messages_used: 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" }),

        supabase.from("whatsapp_configs").update({ 
          automation_enabled: true 
        }).eq("user_id", profile.id)
      ]);

    } else {
      console.log("🚀 Processing Website Chatbot Subscription...");
      
      await supabase.from("subscriptions").upsert({
        user_id: profile.id,
        email: email,
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    return NextResponse.json({ success: true, message: "Webhook processed" });

  } catch (err) {
    console.error("Global Webhook Error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}