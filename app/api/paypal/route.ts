import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plan = (searchParams.get("plan") || "").toLowerCase().trim();
  const email = (searchParams.get("email") || "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json(
      { error: "Email is required to process payment" },
      { status: 400 }
    );
  }

  let baseUrl = "";

  if (plan === "starter") {
    baseUrl = "https://www.paypal.com/ncp/payment/3EHGSNB2E4DUW";
  } else if (plan === "pro") {
    baseUrl = "https://www.paypal.com/ncp/payment/24P73JDAGGGB8";
  } else if (plan === "growth") {
    baseUrl = "https://www.paypal.com/ncp/payment/W9P8U6SXQFHDE";
  } else if (plan === "enterprise") {
    baseUrl = "https://www.paypal.com/ncp/payment/YOUR_ENTERPRISE_PAYPAL_LINK";
  } else if (plan === "whatsapp") {
    baseUrl = "https://www.paypal.com/ncp/payment/N7WHXJVVTREKC";
  }

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Invalid plan" },
      { status: 400 }
    );
  }

  return NextResponse.redirect(baseUrl);
}