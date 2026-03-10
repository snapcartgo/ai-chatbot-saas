import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const plan = searchParams.get("plan");
  // We grab the email passed from your PaymentClient
  const email = searchParams.get("email"); 

  if (!email) {
    return new NextResponse("User email is required for payment", { status: 400 });
  }

  let paymentUrl = "";

  // Note: We use udf1 for email and udf2 for the plan name
  // This allows the webhook to know WHO paid and WHAT they bought
  if (plan === "starter") {
    paymentUrl = `https://u.payu.in/PAYUMN/krc7WBd83Jao?udf1=${encodeURIComponent(email)}&udf2=starter`;
  }

  if (plan === "pro") {
    paymentUrl = `https://u.payu.in/PAYUMN/EIhbCIsXk1ge?udf1=${encodeURIComponent(email)}&udf2=pro`;
  }

  if (plan === "growth") {
    paymentUrl = `https://u.payu.in/PAYUMN/XIRREUqtO4gY?udf1=${encodeURIComponent(email)}&udf2=growth`;
  }

  if (!paymentUrl) {
    return new NextResponse("Invalid Plan Selected", { status: 400 });
  }

  return NextResponse.redirect(paymentUrl);
}