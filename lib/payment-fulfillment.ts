import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_LIMITS = {
  website: {
    starter: { amount: 999, chatbot_limit: 1, message_limit: 1000, product_limit: 25 },
    pro: { amount: 1999, chatbot_limit: 2, message_limit: 3000, product_limit: 75 },
    growth: { amount: 4999, chatbot_limit: 5, message_limit: 10000, product_limit: 200 },
    business: { amount: 7999, chatbot_limit: 10, message_limit: 20000, product_limit: 500 },
  },
  whatsapp: {
    starter: { amount: 1499, message_limit: 1000, product_limit: 25 },
    pro: { amount: 2999, message_limit: 3000, product_limit: 75 },
    growth: { amount: 5499, message_limit: 10000, product_limit: 200 },
    business: { amount: 8499, message_limit: 25000, product_limit: 500 },
  },
  combo: {
    business: {
      amount: 6999,
      web_bots: 10,
      web_messages: 20000,
      wa_messages: 20000,
      product_limit: 200,
    },
    enterprise: {
      amount: 13999,
      web_bots: 20,
      web_messages: 50000,
      wa_messages: 50000,
      product_limit: 500,
    },
  },
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").toLowerCase().trim();
}

export function detectPlanCategoryAndTier(raw: string | null | undefined): {
  category: "website" | "whatsapp" | "combo";
  tier: "starter" | "pro" | "growth" | "business" | "enterprise";
  isBYOK: boolean;
} {
  const value = String(raw || "").toLowerCase().trim();
  const isBYOK = value.includes("byok") || value.includes("qrv2");

  // 1. Combo Plans
  if (value.includes("combo")) {
    if (value.includes("enterprise")) return { category: "combo", tier: "enterprise", isBYOK };
    return { category: "combo", tier: "business", isBYOK };
  }

  // 2. WhatsApp Plans (includes page slugs, hashes, keywords, and Razorpay QR descriptions)
  if (
    value.includes("wa_") ||
    value.includes("whatsapp") ||
    value.includes("tqpa7znyhxwjry") ||
    value.includes("pl_tqpa7znyhxwjry") ||
    value.includes("qrv2") ||
    value.includes("woodpetra") ||
    value === "plan_2"
  ) {
    if (value.includes("business")) return { category: "whatsapp", tier: "business", isBYOK };
    if (value.includes("growth")) return { category: "whatsapp", tier: "growth", isBYOK };
    if (value.includes("pro")) return { category: "whatsapp", tier: "pro", isBYOK };
    return { category: "whatsapp", tier: "starter", isBYOK: true };
  }

  // 3. Website Plans (Default)
  if (value.includes("business") || value.includes("enterprise")) return { category: "website", tier: "business", isBYOK };
  if (value.includes("growth")) return { category: "website", tier: "growth", isBYOK };
  if (value.includes("pro")) return { category: "website", tier: "pro", isBYOK };
  return { category: "website", tier: "starter", isBYOK };
}

// 1. Exact user resolution using your subscriptions table as primary lookup
async function getProfileByEmail(email: string) {
  const normalized = normalizeEmail(email);

  // Check subscriptions table first (contains valid user_id and email/calendar_id)
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id, email, calendar_id")
    .or(`email.ilike.${normalized},calendar_id.ilike.${normalized}`)
    .limit(1)
    .maybeSingle();

  if (sub?.user_id) {
    return { id: sub.user_id, email: sub.email || sub.calendar_id || normalized };
  }

  // Fallback to Supabase Auth Admin list query
  try {
    const { data: authData } = await supabase.auth.admin.listUsers();
    const matchedUser = authData?.users?.find(
      (u) => u.email?.toLowerCase().trim() === normalized
    );
    if (matchedUser?.id) {
      return { id: matchedUser.id, email: matchedUser.email };
    }
  } catch (err) {
    console.warn("Auth admin lookup skipped:", err);
  }

  // Fallback to profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id, email")
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();

  if (profile) {
    return { id: (profile as any).user_id || profile.id, email: profile.email };
  }

  return null;
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

// 2. WhatsApp Plan Activation (Updates existing row OR inserts new row with user_id and email)
async function activateWhatsAppPlan(params: {
  profileId: string;
  email: string;
  tier: "starter" | "pro" | "growth" | "business";
  isBYOK: boolean;
  amount?: number | null;
}) {
  console.log("👉 ACTIVATING WHATSAPP SUBSCRIPTION FOR:", params.profileId, params.email);
  const cfg = PLAN_LIMITS.whatsapp[params.tier];
  const finalAmount = typeof params.amount === "number" && params.amount > 0 ? params.amount : cfg.amount;
  const { nowIso, endIso } = getOneMonthWindow();
  const normalizedEmail = normalizeEmail(params.email);

  // Check if row already exists in whatsapp_subscriptions by user_id OR email
  const { data: existingSub } = await supabase
    .from("whatsapp_subscriptions")
    .select("id, user_id, email")
    .or(`user_id.eq.${params.profileId},email.eq.${normalizedEmail}`)
    .maybeSingle();

  const payload = {
    user_id: params.profileId,
    email: normalizedEmail,
    status: "active",
    plan: `whatsapp_${params.tier}`,
    is_byok: params.isBYOK,
    message_limit: cfg.message_limit,
    product_limit: cfg.product_limit, // 🟢 ADD THIS
    messages_used: 0,
    amount: finalAmount,
    updated_at: nowIso,
    expires_at: endIso,
  };

  let subError;
  if (existingSub?.id) {
    console.log("🔄 Updating existing WhatsApp subscription ID:", existingSub.id);
    const res = await supabase
      .from("whatsapp_subscriptions")
      .update(payload)
      .eq("id", existingSub.id);
    subError = res.error;
  } else {
    console.log("➕ Creating new row in whatsapp_subscriptions with user_id and email");
    const res = await supabase
      .from("whatsapp_subscriptions")
      .insert([payload]);
    subError = res.error;
  }

  if (subError) {
    console.error("❌ whatsapp_subscriptions write error:", subError);
    throw new Error(`WhatsApp Sub Failed: ${subError.message}`);
  }

  // Ensure whatsapp_configs is active
  await supabase.from("whatsapp_configs").upsert(
    {
      user_id: params.profileId,
      automation_enabled: true,
      workflow_type: "whatsapp_only",
    },
    { onConflict: "user_id" }
  );

  console.log("✅ whatsapp_subscriptions updated successfully!");
}

async function activateWebsitePlan(params: {
  profileId: string;
  email: string;
  tier: "starter" | "pro" | "growth" | "business";
  isBYOK: boolean;
  amount?: number | null;
}) {
  const cfg = PLAN_LIMITS.website[params.tier];
  const finalAmount = typeof params.amount === "number" && params.amount > 0 ? params.amount : cfg.amount;
  const { nowIso, endIso, endDate } = getOneMonthWindow();

  const payload = {
    user_id: params.profileId,
    email: normalizeEmail(params.email),
    calendar_id: normalizeEmail(params.email),
    plan: params.tier,
    status: "active",
    amount: finalAmount,
    chatbot_limit: cfg.chatbot_limit,
    message_limit: cfg.message_limit,
    product_limit: cfg.product_limit, // 🟢 ADD THIS
    message_used: 0,
    messages_reset_at: nowIso,
    billing_cycle_start: nowIso,
    billing_cycle_end: endIso,
    plan_expiry: endDate,
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("Subscription upsert error:", error);
    throw new Error(`Website Subscription Failed: ${error.message}`);
  }
}

async function activateComboPlan(params: {
  profileId: string;
  email: string;
  tier: "business" | "enterprise";
  isBYOK: boolean;
  amount?: number | null;
}) {
  const cfg = PLAN_LIMITS.combo[params.tier];
  const finalAmount = typeof params.amount === "number" && params.amount > 0 ? params.amount : cfg.amount;
  const { nowIso, endIso, endDate } = getOneMonthWindow();
  const normalizedEmail = normalizeEmail(params.email);

  const webPromise = supabase.from("subscriptions").upsert(
    {
      user_id: params.profileId,
      email: normalizedEmail,
      calendar_id: normalizedEmail,
      plan: `${params.tier}_combo`,
      status: "active",
      amount: finalAmount,
      chatbot_limit: cfg.web_bots,
      message_limit: cfg.web_messages,
      product_limit: cfg.product_limit, // 🟢 ADD THIS
      message_used: 0,
      messages_reset_at: nowIso,
      billing_cycle_start: nowIso,
      billing_cycle_end: endIso,
      plan_expiry: endDate,
    },
    { onConflict: "user_id" }
  );

  const { data: existingWa } = await supabase
    .from("whatsapp_subscriptions")
    .select("id")
    .or(`user_id.eq.${params.profileId},email.eq.${normalizedEmail}`)
    .maybeSingle();

  const waPayload = {
    user_id: params.profileId,
    email: normalizedEmail,
    status: "active",
    plan: `${params.tier}_combo`,
    is_byok: params.isBYOK,
    message_limit: cfg.wa_messages,
    product_limit: cfg.product_limit, // 🟢 ADD THIS
    messages_used: 0,
    amount: finalAmount,
    updated_at: nowIso,
    expires_at: endIso,
  };

  const waPromise = existingWa?.id
    ? supabase.from("whatsapp_subscriptions").update(waPayload).eq("id", existingWa.id)
    : supabase.from("whatsapp_subscriptions").insert([waPayload]);

  const configPromise = supabase.from("whatsapp_configs").upsert(
    {
      user_id: params.profileId,
      automation_enabled: true,
      workflow_type: "omnichannel",
    },
    { onConflict: "user_id" }
  );

  const [webRes, waRes, cfgRes] = await Promise.all([webPromise, waPromise, configPromise]);

  if (webRes.error) throw new Error(`Combo Web Sub Failed: ${webRes.error.message}`);
  if (waRes.error) throw new Error(`Combo WhatsApp Sub Failed: ${waRes.error.message}`);
  if (cfgRes.error) throw new Error(`Combo WhatsApp Config Failed: ${cfgRes.error.message}`);
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
    .or(`referred_user_id.eq.${params.profileId},referred_email.eq.${normalizedEmail}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (referralError || !referral?.id) return;

  const { data: partner } = await supabase
    .from("partners")
    .select("commission_rate")
    .eq("id", referral.partner_id)
    .maybeSingle();

  const rate = Number(partner?.commission_rate ?? 20);
  const commissionAmount = Number((((Number(params.amount) || 0) * rate) / 100).toFixed(2));

  await supabase
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
}

export async function fulfillSaasBilling(params: {
  email: string;
  rawPlan: string;
  amount?: number | null;
}) {
  console.log("🚀 FULFILL BILLING CALLED WITH:", params);
  const email = normalizeEmail(params.email);

  if (!email) throw new Error("Email is required");

  const profile = await getProfileByEmail(email);
  if (!profile?.id) {
    throw new Error(`User account not found for email: ${email}`);
  }

  const { category, tier, isBYOK } = detectPlanCategoryAndTier(params.rawPlan);

  // WhatsApp Plans
  if (category === "whatsapp") {
    const waTier = tier === "enterprise" ? "business" : tier;
    const finalAmount = typeof params.amount === "number" && params.amount > 0 ? params.amount : PLAN_LIMITS.whatsapp[waTier].amount;

    await activateWhatsAppPlan({
      profileId: profile.id,
      email,
      tier: waTier,
      isBYOK,
      amount: finalAmount,
    });

    await updateReferralAfterPayment({
      profileId: profile.id,
      email,
      purchasedPlan: `whatsapp_${waTier}${isBYOK ? "_byok" : ""}`,
      amount: finalAmount,
    });

    return {
      type: "whatsapp" as const,
      tier: waTier,
      isBYOK,
      amount: finalAmount,
      message_limit: PLAN_LIMITS.whatsapp[waTier].message_limit,
      product_limit: PLAN_LIMITS.whatsapp[waTier].product_limit, // 🟢 ADD THIS
    };
  }

  // Combo Plans
  if (category === "combo") {
    const comboTier = tier === "enterprise" ? "enterprise" : "business";
    const finalAmount = typeof params.amount === "number" && params.amount > 0 ? params.amount : PLAN_LIMITS.combo[comboTier].amount;

    await activateComboPlan({
      profileId: profile.id,
      email,
      tier: comboTier,
      isBYOK,
      amount: finalAmount,
    });

    await updateReferralAfterPayment({
      profileId: profile.id,
      email,
      purchasedPlan: `${comboTier}_combo${isBYOK ? "_byok" : ""}`,
      amount: finalAmount,
    });

    return { type: "combo" as const, tier: comboTier, isBYOK, amount: finalAmount, product_limit: PLAN_LIMITS.combo[comboTier].product_limit };
  }

  // Website Plans
  const webTier = tier === "enterprise" ? "business" : tier;
  const finalAmount = typeof params.amount === "number" && params.amount > 0 ? params.amount : PLAN_LIMITS.website[webTier].amount;

  await activateWebsitePlan({
    profileId: profile.id,
    email,
    tier: webTier,
    isBYOK,
    amount: finalAmount,
  });

  await updateReferralAfterPayment({
    profileId: profile.id,
    email,
    purchasedPlan: `${webTier}${isBYOK ? "_byok" : ""}`,
    amount: finalAmount,
  });

  return {
    type: "website" as const,
    tier: webTier,
    isBYOK,
    amount: finalAmount,
    chatbot_limit: PLAN_LIMITS.website[webTier].chatbot_limit,
    message_limit: PLAN_LIMITS.website[webTier].message_limit,
    product_limit: PLAN_LIMITS.website[webTier].product_limit, // 🟢 ADD THIS
  };
}
export function isWhatsAppPlan(raw: string | null | undefined): boolean {
  const { category } = detectPlanCategoryAndTier(raw);
  return category === "whatsapp";
}

export function normalizePlan(raw: string | null | undefined): string {
  const { category, tier, isBYOK } = detectPlanCategoryAndTier(raw);
  if (category === "whatsapp") {
    return `whatsapp_${tier}${isBYOK ? "_byok" : ""}`;
  }
  if (category === "combo") {
    return `${tier}_combo${isBYOK ? "_byok" : ""}`;
  }
  return `${tier}${isBYOK ? "_byok" : ""}`;
}