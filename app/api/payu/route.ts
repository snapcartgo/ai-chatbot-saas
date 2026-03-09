import { NextResponse } from "next/server";

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");

  let paymentUrl = "";

  if (plan === "starter") {
    paymentUrl = "https://u.payu.in/PAYUMN/krc7WBd83Jao";
  }

  if (plan === "pro") {
    paymentUrl = "https://u.payu.in/PAYUMN/EIhbCIsXk1ge";
  }

  if (plan === "growth") {
    paymentUrl = "https://u.payu.in/PAYUMN/XIRREUqtO4gY";
  }

  if (!paymentUrl) {
    return NextResponse.json(
      { error: "Invalid plan" },
      { status: 400 }
    );
  }

  return NextResponse.redirect(paymentUrl);
}