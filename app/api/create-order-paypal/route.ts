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

    // ✅ Validate required fields
    if (!id || !user_id || !price) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("BODY RECEIVED:", body);

    // ✅ Fetch PayPal credentials
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      console.error("Supabase error:", profileError);
      return NextResponse.json(
        { error: "User not found in profiles" },
        { status: 400 }
      );
    }

    if (!profile.paypal_client_id || !profile.paypal_secret) {
      return NextResponse.json(
        { error: "PayPal credentials missing" },
        { status: 400 }
      );
    }

    // ✅ PayPal Auth
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
      return NextResponse.json(
        { error: "PayPal authentication failed" },
        { status: 500 }
      );
    }

    // ✅ CLEAN PAYPAL REQUEST (VERY IMPORTANT)
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
              description: product_name || "Product",
              amount: {
                currency_code: "USD",
                value: Number(price).toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: "AI Automation Agency",
            user_action: "PAY_NOW",
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/order-success-paypal?order_id=${id}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order-failed?order_id=${id}`,
          },
        }),
      }
    );

    const orderData = await orderRes.json();

    // 🔥 FULL DEBUG
    console.log("PAYPAL RESPONSE:", JSON.stringify(orderData, null, 2));

    if (!orderRes.ok) {
      return NextResponse.json(
        { error: orderData },
        { status: 500 }
      );
    }

    const approvalUrl = orderData.links?.find(
      (l: any) => l.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      return NextResponse.json(
        { error: "No approval URL from PayPal" },
        { status: 500 }
      );
    }

    // ✅ Save order
    await supabase.from("orders").insert({
      order_id: id,
      user_id,
      product_name,
      price,
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
      product_name,
      price,
      customer_email,
      phone,
      name,
    });

  } catch (err: any) {
    console.error("FINAL ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}