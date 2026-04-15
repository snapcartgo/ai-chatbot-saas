import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const saasUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://ai-chatbot-saas-five.vercel.app";

const PLAN_CONFIG: Record<
  "starter" | "pro" | "growth",
  { amount: number; chatbot_limit: number; message_limit: number }
> = {
  starter: { amount: 999, chatbot_limit: 1, message_limit: 1000 },
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

async function resolvePartnerUuid(partnerRef: string | null): Promise<string | null> {
  if (!partnerRef) return null;

  const { data: p1 } = await supabase
    .from("partners")
    .select("id")
    .eq("id", partnerRef)
    .maybeSingle();

  if (p1?.id) return p1.id;

  const { data: p2 } = await supabase
    .from("partners")
    .select("id")
    .eq("referral_code", partnerRef)
    .maybeSingle();

  return p2?.id || null;
}

async function updatePlanAndReferral(
  email: string,
  plan: "starter" | "pro" | "growth",
  amountFromGateway?: number,
  paymentId?: string
) {
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

  const { data: referralRows } = await supabase
    .from("referrals")
    .select("id, partner_id")
    .or(`referred_user_id.eq.${profile.id},referred_email.eq.${email}`);

  if (!referralRows?.length) return;

  const ids = referralRows.map((r: any) => r.id);

  await supabase
    .from("referrals")
    .update({
      amount,
      commission_amount: commission,
      payment_status: "paid",
      status: "completed",
      purchased_plan: plan,
    })
    .in("id", ids);

  for (const ref of referralRows) {
    const partnerUuid = await resolvePartnerUuid(ref.partner_id);
    if (!partnerUuid) continue;

    await supabase
      .from("commissions")
      .upsert(
        {
          partner_id: partnerUuid,
          referral_id: ref.id,
          amount: commission,
          status: "pending",
          payout_date: null,
        },
        { onConflict: "referral_id" }
      );
  }

  if (paymentId) {
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_id: paymentId })
      .eq("customer_email", email)
      .eq("payment_status", "pending");
  }
}

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

    if (!email || !plan) {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=missing_data`, { status: 303 });
    }

    await updatePlanAndReferral(email, plan, amount, paymentId);

    return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=plan`, { status: 303 });
  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.redirect(`${saasUrl}/dashboard?status=error`, { status: 303 });
  }
}
