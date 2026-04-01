import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Ensure n8n passes 'id' (order_id), 'user_id', and 'price'
    const { id, user_id, price } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: "Missing id or user_id in request body" }, { status: 400 });
    }

    // 1. Fetch user's unique PayPal credentials from Supabase
    const { data: profile } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", user_id)
      .single();

    if (!profile?.paypal_client_id || !profile?.paypal_secret) {
      return NextResponse.json(
        { error: "PayPal credentials not configured in Supabase for this user" },
        { status: 400 }
      );
    }

    // 2. Authenticate with PayPal Sandbox
    const auth = Buffer.from(
      `${profile.paypal_client_id}:${profile.paypal_secret}`
    ).toString("base64");

    const tokenRes = await fetch(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("PayPal Auth Failed:", tokenData);
      throw new Error(`Auth Error: ${tokenData.error_description || "Invalid Credentials"}`);
    }

    // 3. Create PayPal Order
    const orderRes = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                // FIX: Ensures price is a string with 2 decimals (e.g., "1.00")
                value: parseFloat(price?.toString() || "1").toFixed(2), 
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                brand_name: "AI Automation Agency",
                locale: "en-US",
                user_action: "PAY_NOW",
                return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/order-success-paypal?order_id=${id}`,
                cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order-failed?order_id=${id}`,
              }
            }
          }
        }),
      }
    );

    const orderData = await orderRes.json();

    // LOGGING: If this fails, check Vercel Logs for the specific schema error
    if (!orderRes.ok) {
        console.error("PAYPAL SCHEMA ERROR:", JSON.stringify(orderData, null, 2));
        throw new Error(orderData.message || "PayPal Order Creation Failed");
    }

    const approvalUrl = orderData.links?.find(
      (l: any) => l.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      throw new Error("No approval URL returned by PayPal");
    }

    // 4. Return 'payment_link' to match your n8n chatbot logic
    return NextResponse.json({
      success: true,
      payment_link: approvalUrl,
    });

  } catch (err: any) {
    console.error("Endpoint Error:", err.message);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}