import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_CONFIG: Record<string, { amount: number; chatbot_limit: number; message_limit: number }> = {
  starter: { amount: 999, chatbot_limit: 1, message_limit: 100 },
  pro: { amount: 1999, chatbot_limit: 2, message_limit: 3000 },
  growth: { amount: 4999, chatbot_limit: 5, message_limit: 12000 },
};

function detectPlan(raw: string): "starter" | "pro" | "growth" | null {
  const v = (raw || "").toLowerCase();
  if (v.includes("starter")) return "starter";
  if (v.includes("pro")) return "pro";
  if (v.includes("growth")) return "growth";
  return null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const status = String(data.status || "").toLowerCase();
    const email = String(data.email || data.udf1 || "").toLowerCase().trim();
    const productinfo = String(data.productinfo || data.udf2 || "").toLowerCase();
    const txnid = String(data.txnid || "");
    const mihpayid = String(data.mihpayid || txnid);
    const amountFromGateway = Number(data.amount || 0);

    if (status !== "success") {
      return NextResponse.json({ success: false, message: "Payment not successful" });
    }

    const plan = detectPlan(productinfo);

    // Mark pending orders paid for this email
    if (email) {
      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_id: mihpayid,
        })
        .eq("customer_email", email)
        .eq("payment_status", "pending");
    }

    if (!plan || !email) {
      return NextResponse.json({ success: true, type: "order_only" });
    }

    const cfg = PLAN_CONFIG[plan];
    const finalAmount = amountFromGateway > 0 ? amountFromGateway : cfg.amount;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (!profile?.id) {
      return NextResponse.json({ success: false, message: "Profile not found" }, { status: 404 });
    }

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 30);

    await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: profile.id,
          email,
          plan,
          status: "active",
          amount: finalAmount,
          chatbot_limit: cfg.chatbot_limit,
          message_limit: cfg.message_limit,
          message_used: 0,
          billing_cycle_start: now.toISOString(),
          billing_cycle_end: expiry.toISOString(),
          plan_expiry: expiry.toISOString(),
        },
        { onConflict: "user_id" }
      );

    const commission = Number((finalAmount * 0.2).toFixed(2));

    const { data: refs } = await supabase
      .from("referrals")
      .select("id")
      .or(`referred_user_id.eq.${profile.id},referred_email.eq.${email}`);

    if (refs?.length) {
      const ids = refs.map((r: any) => r.id);
      await supabase
        .from("referrals")
        .update({
          amount: finalAmount,
          commission_amount: commission,
          payment_status: "paid",
          status: "completed",
        })
        .in("id", ids);
    }

    return NextResponse.json({ success: true, type: "subscription" });
  } catch (err) {
    console.error("Webhook Global Error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
