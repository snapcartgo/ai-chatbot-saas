import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, planId } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "No email session found" }, { status: 400 });
    }

    // FIXED: Query the correct 'profiles' table from your schema layout
    const { data: userData, error: userError } = await supabaseAdmin
      .from("profiles") 
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (userError || !userData) {
      console.error("❌ Test Bypass Failure: User email not found inside profiles table:", email);
      return NextResponse.json({ error: "User account could not be found in profiles table" }, { status: 404 });
    }

    const userId = userData.id;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    // 2. Force upsert directly into subscriptions table
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        user_id: userId,
        email: email,
        plan: planId || "starter",
        status: "active",
        chatbot_limit: planId === "starter" ? 1 : 3,
        message_limit: planId === "starter" ? 1000 : 3000,
        message_used: 0,
        amount: 0, 
        messages_reset_at: startDate.toISOString(),
        billing_cycle_start: startDate.toISOString(),
        billing_cycle_end: endDate.toISOString(),
        plan_expiry: endDate.toISOString().split("T")[0], 
      }, { onConflict: "user_id" });

    if (subError) {
      console.error("❌ Supabase Upsert Error:", subError.message);
      return NextResponse.json({ error: subError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("❌ Crash in test bypass endpoint:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}