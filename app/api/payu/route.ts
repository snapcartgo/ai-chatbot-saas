import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const plan = (searchParams.get("plan") || "").toLowerCase().trim();
  const email = (searchParams.get("email") || "").toLowerCase().trim();

  if (!email) {
    return new NextResponse("User email is required for payment", { status: 400 });
  }

  // =========================
  // PLAN PRICING
  // =========================
  const planPrices: { [key: string]: number } = {
    starter: 999,
    pro: 1999,
    growth: 4999,
    whatsapp: 999, // ✅ NEW
  };

  const amount = planPrices[plan] || 0;

  // =========================
  // PAYMENT LINKS
  // =========================
  let paymentUrl = "";

  // EXISTING PLANS (UNCHANGED)
  if (plan === "starter") {
    paymentUrl = `https://u.payu.in/PAYUMN/krc7WBd83Jao`;
  }

  if (plan === "pro") {
    paymentUrl = `https://u.payu.in/PAYUMN/aJJ8bNGO12O4`;
  }

  if (plan === "growth") {
    paymentUrl = `https://u.payu.in/PAYUMN/ar3pLNf5BGsK`;
  }

  // =========================
  // 🆕 WHATSAPP PLAN
  // =========================
  if (plan === "whatsapp") {
    // 👉 IMPORTANT:
    // Create ONE PayU payment link from dashboard
    // and paste it here
    paymentUrl = `https://u.payu.in/PAYUMN/REPLACE_WITH_YOUR_WHATSAPP_LINK`;
  }

  if (!paymentUrl) {
    return new NextResponse("Invalid Plan Selected", { status: 400 });
  }

  // =========================
  // FINAL REDIRECT
  // =========================
  const finalUrl = `${paymentUrl}?udf1=${encodeURIComponent(email)}&udf2=${encodeURIComponent(plan)}&amount=${amount}`;

  return NextResponse.redirect(finalUrl);
}