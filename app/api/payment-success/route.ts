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

function normalizePlan(raw: string | null | undefined) {
  const v = (raw || "").toLowerCase().trim();
  if (v.includes("starter")) return "starter";
  if (v.includes("pro")) return "pro";
  if (v.includes("growth")) return "growth";
  return null;
}

function isWhatsAppPlan(raw: string | null | undefined) {
  return (raw || "").toLowerCase().includes("whatsapp");
}

async function activateWhatsAppPlan(email: string, paymentId?: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile?.id) return;

  await supabase.from("whatsapp_subscriptions").upsert({
    user_id: profile.id,
    status: "active",
    plan: "basic",
    messages_used: 0,
    message_limit: 1000,
    updated_at: new Date().toISOString(),
  });

  if (paymentId) {
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_id: paymentId })
      .eq("customer_email", email);
  }
}

// ✅ EXISTING FUNCTION (UNCHANGED)
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

  await supabase.from("subscriptions").upsert(
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

  if (paymentId) {
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_id: paymentId })
      .eq("customer_email", email);
  }
}

// =======================
// GET HANDLER
// =======================
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const email = (searchParams.get("email") || "").toLowerCase().trim();
  const rawPlan = searchParams.get("plan") || "";

  if (!email) {
    return NextResponse.redirect(`${saasUrl}/dashboard?error=missing_email`);
  }

  // ✅ WhatsApp Flow
  if (isWhatsAppPlan(rawPlan)) {
    await activateWhatsAppPlan(email);
    return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=whatsapp`);
  }

  // ✅ Normal Plan Flow
  const plan = normalizePlan(rawPlan);
  if (!plan) {
    return NextResponse.redirect(`${saasUrl}/dashboard?error=invalid_plan`);
  }

  await updatePlanAndReferral(email, plan);

  return NextResponse.redirect(`${saasUrl}/dashboard/payment-success`);
}

// =======================
// POST HANDLER (PayU)
// =======================
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const status = (formData.get("status") || "").toString().toLowerCase();
    const email = (formData.get("email") || "").toString().toLowerCase().trim();
    const rawPlan = (formData.get("udf2") || "").toString();
    const paymentId = (formData.get("mihpayid") || "").toString();

    if (status !== "success") {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=failed`);
    }

    if (!email) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=missing_email`);
    }

    // ✅ WhatsApp Flow
    if (isWhatsAppPlan(rawPlan)) {
      await activateWhatsAppPlan(email, paymentId);
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=whatsapp`);
    }

    // ✅ Normal Plan Flow
    const plan = normalizePlan(rawPlan);
    if (!plan) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=invalid_plan`);
    }

    await updatePlanAndReferral(email, plan, undefined, paymentId);

    return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=plan`);
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${saasUrl}/dashboard?error=server`);
  }
}