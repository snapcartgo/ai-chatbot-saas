import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const rawPlan = (searchParams.get("plan") || "").toLowerCase().trim();
  const email = (searchParams.get("email") || "").toLowerCase().trim();
  const isBYOKParam = searchParams.get("byok") || searchParams.get("isBYOK");
  const isBYOK = isBYOKParam === "true" || rawPlan.includes("byok");

  if (!email) {
    return new NextResponse("User email is required for payment", { status: 400 });
  }

  // Normalize plan key
  const planKey = rawPlan.replace("_byok", "").replace("byok", "").trim();

  // 1. Pricing Configuration (Standard vs BYOK)
  const PLAN_CONFIG: Record<
    string,
    { standardPrice: number; byokPrice: number; standardUrl: string; byokUrl: string }
  > = {
    // Website Plans
    starter: {
      standardPrice: 1499,
      byokPrice: 999,
      standardUrl: "https://u.payu.in/PAYUMN/krc7WBd83Jao",
      byokUrl: "https://u.payu.in/PAYUMN/krc7WBd83Jao", // Replace with your Starter BYOK link if different
    },
    pro: {
      standardPrice: 2999,
      byokPrice: 1999,
      standardUrl: "https://u.payu.in/PAYUMN/aJJ8bNGO12O4",
      byokUrl: "https://u.payu.in/PAYUMN/aJJ8bNGO12O4", // Replace with your Pro BYOK link if different
    },
    growth: {
      standardPrice: 5499,
      byokPrice: 3499,
      standardUrl: "https://u.payu.in/PAYUMN/ar3pLNf5BGsK",
      byokUrl: "https://u.payu.in/PAYUMN/ar3pLNf5BGsK", // Replace with your Growth BYOK link if different
    },
    business: {
      standardPrice: 7999,
      byokPrice: 4999,
      standardUrl: "https://u.payu.in/PAYUMN/YOUR_BUSINESS_STANDARD_LINK",
      byokUrl: "https://u.payu.in/PAYUMN/YOUR_BUSINESS_BYOK_LINK",
    },

    // WhatsApp Automation Plans
    whatsapp_starter: {
      standardPrice: 1499,
      byokPrice: 999,
      standardUrl: "https://u.payu.in/PAYUMN/kJU8IVJOMD8V",
      byokUrl: "https://u.payu.in/PAYUMN/kJU8IVJOMD8V", // Replace with your WA Starter BYOK link if different
    },
    whatsapp_pro: {
      standardPrice: 2999,
      byokPrice: 1999,
      standardUrl: "https://u.payu.in/PAYUMN/YOUR_WA_PRO_STANDARD_LINK",
      byokUrl: "https://u.payu.in/PAYUMN/YOUR_WA_PRO_BYOK_LINK",
    },
    whatsapp_growth: {
      standardPrice: 5499,
      byokPrice: 3499,
      standardUrl: "https://u.payu.in/PAYUMN/YOUR_WA_GROWTH_STANDARD_LINK",
      byokUrl: "https://u.payu.in/PAYUMN/YOUR_WA_GROWTH_BYOK_LINK",
    },
    whatsapp_business: {
      standardPrice: 8499,
      byokPrice: 5499,
      standardUrl: "https://u.payu.in/PAYUMN/YOUR_WA_BUSINESS_STANDARD_LINK",
      byokUrl: "https://u.payu.in/PAYUMN/YOUR_WA_BUSINESS_BYOK_LINK",
    },
    whatsapp: {
      standardPrice: 1499,
      byokPrice: 999,
      standardUrl: "https://u.payu.in/PAYUMN/kJU8IVJOMD8V",
      byokUrl: "https://u.payu.in/PAYUMN/kJU8IVJOMD8V",
    },

    // Omnichannel Combo Plans (Website + WhatsApp)
    business_combo: {
      standardPrice: 9999,
      byokPrice: 6999,
      standardUrl: "https://u.payu.in/PAYUMN/YOUR_COMBO_BUSINESS_STANDARD_LINK",
      byokUrl: "https://u.payu.in/PAYUMN/YOUR_COMBO_BUSINESS_BYOK_LINK",
    },
    enterprise_combo: {
      standardPrice: 19999,
      byokPrice: 13999,
      standardUrl: "https://u.payu.in/PAYUMN/YOUR_COMBO_ENTERPRISE_STANDARD_LINK",
      byokUrl: "https://u.payu.in/PAYUMN/YOUR_COMBO_ENTERPRISE_BYOK_LINK",
    },
  };

  const selectedPlan = PLAN_CONFIG[planKey] || PLAN_CONFIG["starter"];

  if (!selectedPlan) {
    return new NextResponse("Invalid Plan Selected", { status: 400 });
  }

  const amount = isBYOK ? selectedPlan.byokPrice : selectedPlan.standardPrice;
  const baseUrl = isBYOK ? selectedPlan.byokUrl : selectedPlan.standardUrl;
  const planTag = `${planKey}${isBYOK ? "_byok" : ""}`;

  // 2. Append standard query params for PayU metadata passing
  const delimiter = baseUrl.includes("?") ? "&" : "?";
  const finalUrl = `${baseUrl}${delimiter}udf1=${encodeURIComponent(
    email
  )}&udf2=${encodeURIComponent(planTag)}&amount=${amount}`;

  return NextResponse.redirect(finalUrl);
}