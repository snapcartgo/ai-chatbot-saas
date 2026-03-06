import { NextResponse } from "next/server";

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");

  let paymentUrl = "";

  if (plan === "starter") {
    paymentUrl = "https://www.paypal.com/ncp/payment/YBG2WL38PRRUA";
  }

  if (plan === "pro") {
    paymentUrl = "https://www.paypal.com/checkoutnow?pro";
  }

  if (plan === "growth") {
    paymentUrl = "https://www.paypal.com/checkoutnow?growth";
  }

  if (!paymentUrl) {
    return NextResponse.json(
      { error: "Invalid plan" },
      { status: 400 }
    );
  }

  return NextResponse.redirect(paymentUrl);
}