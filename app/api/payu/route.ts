import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const plan = (searchParams.get("plan") || "").toLowerCase().trim();
  const email = (searchParams.get("email") || "").toLowerCase().trim();

  if (!email) {
    return new NextResponse("User email is required for payment", { status: 400 });
  }

  const planPrices: Record<string, number> = {
    starter: 999,
    pro: 1999,
    growth: 4999,
    enterprise: 15000,
    whatsapp: 999,
  };

  const amount = planPrices[plan] || 0;

  let paymentUrl = "";

  if (plan === "starter") {
    paymentUrl = "https://u.payu.in/PAYUMN/krc7WBd83Jao";
  } else if (plan === "pro") {
    paymentUrl = "https://u.payu.in/PAYUMN/aJJ8bNGO12O4";
  } else if (plan === "growth") {
    paymentUrl = "https://u.payu.in/PAYUMN/ar3pLNf5BGsK";
  } else if (plan === "enterprise") {
    paymentUrl = "https://u.payu.in/PAYUMN/YOUR_ENTERPRISE_LINK_HERE";
  } else if (plan === "whatsapp") {
    paymentUrl = "https://u.payu.in/PAYUMN/kJU8IVJOMD8V";
  }

  if (!paymentUrl) {
    return new NextResponse("Invalid Plan Selected", { status: 400 });
  }

  const finalUrl = `${paymentUrl}?udf1=${encodeURIComponent(
    email
  )}&udf2=${encodeURIComponent(plan)}&amount=${amount}`;

  return NextResponse.redirect(finalUrl);
}