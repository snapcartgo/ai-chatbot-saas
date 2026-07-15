import { createClient } from "@supabase/supabase-js";



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_CONFIG: Record<
  "starter" | "pro" | "growth" | "enterprise",
  {
    amount: number;
    chatbot_limit: number;
    message_limit: number;
  }
> = {
  starter: {
    amount: 999,
    chatbot_limit: 1,
    message_limit: 1000,
  },
  pro: {
    amount: 1999,
    chatbot_limit: 2,
    message_limit: 3000,
  },
  growth: {
    amount: 4999,
    chatbot_limit: 5,
    message_limit: 12000,
  },
  enterprise: {
    amount: 15000,
    chatbot_limit: 10,
    message_limit: 20000,
  },
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
}

export function normalizePlan(raw: string | null | undefined) {
  const value = String(raw || "").toLowerCase().trim();

  if (value.includes("starter")) return "starter";
  if (value.includes("enterprise")) return "enterprise";
  if (value.includes("growth")) return "growth";
  if (value.includes("pro")) return "pro";

  return null;
}

export function isWhatsAppPlan(raw: string | null | undefined) {
  const value = String(raw || "").toLowerCase().trim();
  return value.includes("whatsapp") || value === "plan_2";
}

async function getProfileByEmail(email: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", normalizeEmail(email))
    .maybeSingle();

  if (error) {
    console.error("Profile lookup error:", error);
    return null;
  }

  return data;
}

function getOneMonthWindow() {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  return {
    nowIso: now.toISOString(),
    endIso: end.toISOString(),
    endDate: end.toISOString().split("T")[0],
  };
}

async function activateWebsitePlan(params: {
  profileId: string;
  email: string;
  plan: "starter" | "pro" | "growth" | "enterprise";
  amount?: number | null;
}) {
  const cfg = PLAN_CONFIG[params.plan];
  const finalAmount =
    typeof params.amount === "number" && params.amount > 0
      ? params.amount
      : cfg.amount;

  const { nowIso, endIso, endDate } = getOneMonthWindow();

  const payload = {
    user_id: params.profileId,
    email: normalizeEmail(params.email),
    calendar_id: normalizeEmail(params.email),
    plan: params.plan,
    status: "active",
    amount: finalAmount,
    chatbot_limit: cfg.chatbot_limit,
    message_limit: cfg.message_limit,
    message_used: 0,
    messages_reset_at: nowIso,
    billing_cycle_start: nowIso,
    billing_cycle_end: endIso,
    plan_expiry: endDate,
    updated_at: nowIso,
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("Subscription upsert error:", error);
    throw new Error(error.message);
  }
}

async function activateWhatsAppPlan(profileId: string) {
  console.log("ACTIVATE WHATSAPP PLAN FOR:", profileId);
  const { nowIso, endIso } = getOneMonthWindow();

  const [{ error: subError }, { error: configError }] = await Promise.all([
    supabase.from("whatsapp_subscriptions").upsert(
      {
        user_id: profileId,
        status: "active",
        plan: "whatsapp_automation",
        message_limit: 1000,
        messages_used: 0,
        updated_at: nowIso,
        expires_at: endIso,
      },
      { onConflict: "user_id" }
    ),
    supabase.from("whatsapp_configs").upsert(
      {
        user_id: profileId,
        automation_enabled: true,
        workflow_type: "whatsapp_only",
      },
      { onConflict: "user_id" }
    ),
  ]);
   console.log("WHATSAPP UPSERT COMPLETED");
   
  if (subError) {
    console.error("WhatsApp subscription upsert error:", subError);
    throw new Error(subError.message);
  }

  if (configError) {
    console.error("WhatsApp config upsert error:", configError);
    throw new Error(configError.message);
  }
}

async function updateReferralAfterPayment(params: {
  profileId: string;
  email: string;
  purchasedPlan: string;
  amount: number;
}) {
  const normalizedEmail = normalizeEmail(params.email);

  const { data: referral, error: referralError } = await supabase
    .from("referrals")
    .select("id, partner_id")
    .or(
      `referred_user_id.eq.${params.profileId},referred_email.eq.${normalizedEmail}`
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (referralError) {
    console.error("Referral lookup error:", referralError);
    return;
  }

  if (!referral?.id) return;

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("commission_rate")
    .eq("id", referral.partner_id)
    .maybeSingle();

  if (partnerError) {
    console.error("Partner lookup error:", partnerError);
  }

  const rate = Number(partner?.commission_rate ?? 20);
  const commissionAmount = Number(
    ((Number(params.amount || 0) * rate) / 100).toFixed(2)
  );

  const { error: updateError } = await supabase
    .from("referrals")
    .update({
      referred_user_id: params.profileId,
      referred_email: normalizedEmail,
      purchased_plan: params.purchasedPlan,
      amount: params.amount,
      commission_amount: commissionAmount,
      payment_status: "paid",
      status: "converted",
    })
    .eq("id", referral.id);

  if (updateError) {
    console.error("Referral update error:", updateError);
  }
}

export async function fulfillSaasBilling(params: {
  email: string;
  rawPlan: string;
  amount?: number | null;
}) {
  
  console.log("FULFILL BILLING INPUT:", params);
  const email = normalizeEmail(params.email);

  if (!email) {
    throw new Error("Email is required");
  }

  const profile = await getProfileByEmail(email);
  console.log("PROFILE FOUND:", profile);

  if (!profile?.id) {
    throw new Error(`Profile not found for ${email}`);
  }

  if (isWhatsAppPlan(params.rawPlan)) {
    console.log("WHATSAPP PLAN BRANCH HIT:", params.rawPlan);
    const finalAmount =
      typeof params.amount === "number" && params.amount > 0
        ? params.amount
        : 999;

    await activateWhatsAppPlan(profile.id);

    await updateReferralAfterPayment({
      profileId: profile.id,
      email,
      purchasedPlan: "whatsapp",
      amount: finalAmount,
    });

    return {
      type: "whatsapp" as const,
      amount: finalAmount,
    };
  }

  const plan = normalizePlan(params.rawPlan);

  if (!plan) {
    throw new Error(`Invalid SaaS plan: ${params.rawPlan}`);
  }

  const finalAmount =
    typeof params.amount === "number" && params.amount > 0
      ? params.amount
      : PLAN_CONFIG[plan].amount;

  await activateWebsitePlan({
    profileId: profile.id,
    email,
    plan,
    amount: finalAmount,
  });

  await updateReferralAfterPayment({
    profileId: profile.id,
    email,
    purchasedPlan: plan,
    amount: finalAmount,
  });

  return {
    type: "website" as const,
    plan,
    amount: finalAmount,
    chatbot_limit: PLAN_CONFIG[plan].chatbot_limit,
    message_limit: PLAN_CONFIG[plan].message_limit,
  };
}