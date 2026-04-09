import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const saasUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://ai-chatbot-saas-five.vercel.app";

const PLAN_CONFIG: Record<string, { amount: number; chatbot_limit: number; message_limit: number }> = {
  starter: { amount: 999, chatbot_limit: 1, message_limit: 100 },
  pro: { amount: 1999, chatbot_limit: 2, message_limit: 3000 },
  growth: { amount: 4999, chatbot_limit: 5, message_limit: 12000 },
};

function normalizePlan(raw: string | null | undefined): "starter" | "pro" | "growth" | null {
  const v = (raw || "").toLowerCase().trim();
  if (v.includes("starter")) return "starter";
  if (v.includes("pro")) return "pro";
  if (v.includes("growth")) return "growth";
  return null;
}

function normalizeStatus(raw: string | null | undefined): string {
  return (raw || "").toLowerCase().trim();
}

async function updatePlanAndReferral(email: string, plan: "starter" | "pro" | "growth", amountFromGateway?: number) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile?.id) return;

  const cfg = PLAN_CONFIG[plan];
  const amount =
    typeof amountFromGateway === "number" && amountFromGateway > 0
      ? amountFromGateway
      : cfg.amount;

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
        amount,
        chatbot_limit: cfg.chatbot_limit,
        message_limit: cfg.message_limit,
        message_used: 0,
        billing_cycle_start: now.toISOString(),
        billing_cycle_end: expiry.toISOString(),
        plan_expiry: expiry.toISOString(),
      },
      { onConflict: "user_id" }
    );

  const commission = Number((amount * 0.2).toFixed(2));

  const { data: refRows } = await supabase
    .from("referrals")
    .select("id")
    .or(`referred_user_id.eq.${profile.id},referred_email.eq.${email}`);

  if (refRows?.length) {
    const ids = refRows.map((r: any) => r.id);

    await supabase
      .from("referrals")
      .update({
        amount,
        commission_amount: commission,
        payment_status: "paid",
        status: "completed",
      })
      .in("id", ids);
  }
}

// GET: for return URLs where query params come back
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const email = (searchParams.get("email") || searchParams.get("udf1") || "")
    .toLowerCase()
    .trim();
  const plan = normalizePlan(searchParams.get("plan") || searchParams.get("udf2"));
  const amount = Number(searchParams.get("amount") || 0);

  if (!email || !plan) {
    return NextResponse.redirect(`${saasUrl}/dashboard?payment=missing_data`, { status: 303 });
  }

  await updatePlanAndReferral(email, plan, amount);

  return NextResponse.redirect(`${saasUrl}/dashboard/payment-success`, { status: 303 });
}

// POST: for gateways/webhooks posting form-data
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const status = normalizeStatus(formData.get("status")?.toString());
    const txnid = formData.get("txnid")?.toString() || "";
    const paymentId = formData.get("mihpayid")?.toString() || txnid;

    const email = (formData.get("email") || formData.get("udf1") || "")
      .toString()
      .toLowerCase()
      .trim();

    const rawPlan =
      formData.get("udf2")?.toString() ||
      formData.get("plan")?.toString() ||
      formData.get("productinfo")?.toString() ||
      "";

    const plan = normalizePlan(rawPlan);
    const amount = Number(formData.get("amount") || 0);

    if (status && status !== "success") {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=failed`, { status: 303 });
    }

    // optional: mark related pending order(s) paid by email
    if (email) {
      await supabase
        .from("orders")
        .update({ payment_status: "paid", payment_id: paymentId })
        .eq("customer_email", email)
        .eq("payment_status", "pending");
    }

    if (!email || !plan) {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=missing_data`, { status: 303 });
    }

    await updatePlanAndReferral(email, plan, amount);

    return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=plan`, { status: 303 });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.redirect(`${saasUrl}/dashboard?status=error`, { status: 303 });
  }
}
