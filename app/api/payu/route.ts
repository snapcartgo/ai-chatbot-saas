import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const plan = searchParams.get("plan");
  const email = searchParams.get("email");

  if (!email) {
    return new NextResponse("User email is required for payment", { status: 400 });
  }

  // Define Prices for Commission Calculation later
  const planPrices: { [key: string]: number } = {
    starter: 499,
    pro: 1999,
    growth: 4999
  };

  const amount = planPrices[plan as string] || 0;
  let paymentUrl = "";

  // STARTER PLAN
  if (plan === "starter") {
    paymentUrl = `https://u.payu.in/PAYUMN/krc7WBd83Jao`; 
  }

  // PRO PLAN
  if (plan === "pro") {
    paymentUrl = `https://u.payu.in/PAYUMN/aJJ8bNGO12O4`;
  }

  // GROWTH PLAN
  if (plan === "growth") {
    paymentUrl = `https://u.payu.in/PAYUMN/ar3pLNf5BGsK`;
  }

  if (!paymentUrl) {
    return new NextResponse("Invalid Plan Selected", { status: 400 });
  }

  // CRITICAL: You must append the email and amount as Query Parameters 
  // so your success page can read them back!
  const finalUrl = `${paymentUrl}?udf1=${encodeURIComponent(email)}&udf2=${plan}&amount=${amount}`;

  return NextResponse.redirect(finalUrl);
}