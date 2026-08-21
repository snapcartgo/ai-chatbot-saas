import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const rawPlan = (searchParams.get("plan") || "").toLowerCase().trim();
  const email = (searchParams.get("email") || "").toLowerCase().trim();
  const isBYOKParam = searchParams.get("byok") || searchParams.get("isBYOK");
  const isBYOK = isBYOKParam === "true" || rawPlan.includes("byok");

  if (!email) {
    return NextResponse.json(
      { error: "Email is required to process payment" },
      { status: 400 }
    );
  }

  // Normalize plan key (e.g. "starter_byok" -> "starter")
  const planKey = rawPlan.replace("_byok", "").replace("byok", "").trim();

  // 1. PayPal Link Configuration (Standard vs BYOK)
  const PAYPAL_LINKS: Record<
    string,
    { standardUrl: string; byokUrl: string }
  > = {
    // Website Plans
    starter: {
      standardUrl: "https://www.paypal.com/ncp/payment/3EHGSNB2E4DUW",
      byokUrl: "https://www.paypal.com/ncp/payment/3EHGSNB2E4DUW", // Replace with your Starter BYOK link if different
    },
    pro: {
      standardUrl: "https://www.paypal.com/ncp/payment/24P73JDAGGGB8",
      byokUrl: "https://www.paypal.com/ncp/payment/24P73JDAGGGB8", // Replace with your Pro BYOK link if different
    },
    growth: {
      standardUrl: "https://www.paypal.com/ncp/payment/W9P8U6SXQFHDE",
      byokUrl: "https://www.paypal.com/ncp/payment/W9P8U6SXQFHDE", // Replace with your Growth BYOK link if different
    },
    business: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_BUSINESS_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_BUSINESS_BYOK_PAYPAL_LINK",
    },
    enterprise: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_ENTERPRISE_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_ENTERPRISE_BYOK_PAYPAL_LINK",
    },

    // WhatsApp Automation Plans
    whatsapp_starter: {
      standardUrl: "https://www.paypal.com/ncp/payment/N7WHXJVVTREKC",
      byokUrl: "https://www.paypal.com/ncp/payment/N7WHXJVVTREKC", // Replace with your WA Starter BYOK link if different
    },
    whatsapp_pro: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_WA_PRO_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_WA_PRO_BYOK_PAYPAL_LINK",
    },
    whatsapp_growth: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_WA_GROWTH_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_WA_GROWTH_BYOK_PAYPAL_LINK",
    },
    whatsapp_business: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_WA_BUSINESS_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_WA_BUSINESS_BYOK_PAYPAL_LINK",
    },
    whatsapp: {
      standardUrl: "https://www.paypal.com/ncp/payment/N7WHXJVVTREKC",
      byokUrl: "https://www.paypal.com/ncp/payment/N7WHXJVVTREKC",
    },

    // Omnichannel Combo Plans
    business_combo: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_COMBO_BUSINESS_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_COMBO_BUSINESS_BYOK_PAYPAL_LINK",
    },
    enterprise_combo: {
      standardUrl: "https://www.paypal.com/ncp/payment/YOUR_COMBO_ENTERPRISE_PAYPAL_LINK",
      byokUrl: "https://www.paypal.com/ncp/payment/YOUR_COMBO_ENTERPRISE_BYOK_PAYPAL_LINK",
    },
  };

  const selectedConfig = PAYPAL_LINKS[planKey] || PAYPAL_LINKS["starter"];

  if (!selectedConfig) {
    return NextResponse.json(
      { error: "Invalid plan selected" },
      { status: 400 }
    );
  }

  const baseUrl = isBYOK ? selectedConfig.byokUrl : selectedConfig.standardUrl;
  const planTag = `${planKey}${isBYOK ? "_byok" : ""}`;

  // 2. Append custom tracking parameters for user and plan identification
  const delimiter = baseUrl.includes("?") ? "&" : "?";
  const finalUrl = `${baseUrl}${delimiter}custom=${encodeURIComponent(
    JSON.stringify({ email, plan: planTag })
  )}`;

  return NextResponse.redirect(finalUrl);
}