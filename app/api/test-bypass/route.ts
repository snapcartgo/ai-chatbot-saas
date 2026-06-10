import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, planId } = await req.json();

    // 1. Find user ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    // 2. Force upsert into subscriptions table
    const { error: subError } = await supabaseAdmin
      .from("subscriptions")
      .upsert({
        user_id: userData.id,
        email: email,
        plan: planId,
        status: "active",
        chatbot_limit: planId === "starter" ? 1 : 3,
        message_limit: planId === "starter" ? 1000 : 3000,
        message_used: 0,
        amount: 0, // Free bypass
        messages_reset_at: startDate.toISOString(),
        billing_cycle_start: startDate.toISOString(),
        billing_cycle_end: endDate.toISOString(),
        plan_expiry: endDate.toISOString().split("T")[0],
      }, { onConflict: "user_id" });

    if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}