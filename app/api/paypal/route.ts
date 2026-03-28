import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan");
  const email = searchParams.get("email"); // Get email from your frontend billing page

  if (!email) {
    return NextResponse.json(
      { error: "Email is required to process payment" },
      { status: 400 }
    );
  }

  let baseUrl = "";

  // Replace these with your actual PayPal "No-Code" link URLs from your dashboard
  if (plan === "starter") {
    baseUrl = "https://www.paypal.com/ncp/payment/3EHGSNB2E4DUW";
  } else if (plan === "pro") {
    baseUrl = "https://www.paypal.com/ncp/payment/24P73JDAGGGB8"; 
  } else if (plan === "growth") {
    baseUrl = "https://www.paypal.com/ncp/payment/W9P8U6SXQFHDE";
  }

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Invalid plan" },
      { status: 400 }
    );
  }

  // We append the email and plan to the PayPal URL. 
  // Note: PayPal static links may ignore extra params, 
  // so ensure your PayPal "Return URL" in the dashboard 
  // is set to: https://ai-chatbot-saas-five.vercel.app/api/payment-success?plan=${plan}&email=${email}
  
  return NextResponse.redirect(baseUrl);
}