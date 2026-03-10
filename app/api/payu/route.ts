import { NextResponse } from "next/server";

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");

  if (!plan) {
    return NextResponse.json(
      { error: "Plan not provided" },
      { status: 400 }
    );
  }

  let paymentUrl: string | null = null;

  switch (plan) {

    case "starter":
      paymentUrl = "https://u.payu.in/PAYUMN/krc7WBd83Jao";
      break;

    case "pro":
      paymentUrl = "https://u.payu.in/PAYUMN/EIhbCIsXk1ge";
      break;

    case "growth":
      paymentUrl = "https://u.payu.in/PAYUMN/XIRREUqtO4gY";
      break;

    default:
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
  }

  return NextResponse.redirect(paymentUrl);
}