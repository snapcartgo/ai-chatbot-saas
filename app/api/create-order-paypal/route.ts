import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      id,
      user_id,
      price,
      product_name,
      customer_email,
      phone,
      name,
      bot_id,
    } = body;

    // 1. Validate required fields
    if (!id || !user_id || !price) {
      return NextResponse.json(
        { error: "Missing required fields (id, user_id, or price)" },
        { status: 400 }
      );
    }

    // 2. Fetch PayPal credentials from Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", user_id)
      .single();

    if (profileError || !profile || !profile.paypal_client_id || !profile.paypal_secret) {
      return NextResponse.json(
        { error: "PayPal credentials not found or incomplete for this profile" },
        { status: 400 }
      );
    }

    // 3. PayPal Authentication
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
      throw new Error("Failed to retrieve PayPal access token");
    }

    // 4. Create PayPal Order with exact schema matching
    // Note: Use 'payment_source' for modern PayPal API compliance
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
              reference_id: id,
              description: product_name?.substring(0, 127) || "Order",
              amount: {
                currency_code: "USD",
                value: parseFloat(price.toString()).toFixed(2),
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "AI Automation Agency",
                locale: "en-US",
                user_action: "PAY_NOW",
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/order-success-paypal?order_id=${id}`,
                cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order-failed?order_id=${id}`,
              },
            },
          },
        }),
      }
    );

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      console.error("PAYPAL ERROR DETAILS:", JSON.stringify(orderData, null, 2));
      return NextResponse.json({ error: orderData }, { status: 500 });
    }

    const approvalUrl = orderData.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href;

    if (!approvalUrl) {
      return NextResponse.json({ error: "No approval URL returned from PayPal" }, { status: 500 });
    }

    // 5. Save to Supabase (only if PayPal order creation succeeded)
    await supabase.from("orders").insert({
      order_id: id,
      user_id,
      product_name,
      price: parseFloat(price.toString()),
      customer_email,
      phone,
      name,
      bot_id,
      payment_link: approvalUrl,
      status: "pending",
    });

    return NextResponse.json({
      success: true,
      payment_link: approvalUrl,
      order_id: id,
    });

  } catch (err: any) {
    console.error("SERVER ERROR:", err.message);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}