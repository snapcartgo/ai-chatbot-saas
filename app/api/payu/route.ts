import { NextResponse } from "next/server";

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);

  const plan = searchParams.get("plan");
  const email = searchParams.get("email");

  if (!email) {
    return new NextResponse("User email is required for payment", { status: 400 });
  }

  let paymentUrl = "";

  // STARTER PLAN
  if (plan === "starter") {
    paymentUrl = `https://u.payu.in/PAYUMN/krc7WBd83Jao?udf1=${encodeURIComponent(email)}&udf2=starter`;
  }

  // PRO PLAN
  if (plan === "pro") {
    paymentUrl = `https://u.payu.in/PAYUMN/aJJ8bNGO12O4?udf1=${encodeURIComponent(email)}&udf2=pro`;
  }

  // GROWTH PLAN
  if (plan === "growth") {
    paymentUrl = `https://u.payu.in/PAYUMN/ar3pLNf5BGsK?udf1=${encodeURIComponent(email)}&udf2=growth`;
  }

  if (!paymentUrl) {
    return new NextResponse("Invalid Plan Selected", { status: 400 });
  }

  return NextResponse.redirect(paymentUrl);
}