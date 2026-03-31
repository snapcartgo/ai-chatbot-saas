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
      bot_id,
      user_id,
      product_name,
      price,
      customer_email,
      phone,
      name,
    } = body;

    if (!id || !user_id) {
      return NextResponse.json(
        { error: "Missing order data" },
        { status: 400 }
      );
    }

    // ✅ Get PayPal credentials
    const { data: profile } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", user_id)
      .single();

    if (!profile?.paypal_client_id) {
      return NextResponse.json(
        { error: "PayPal not configured" },
        { status: 400 }
      );
    }

    const clientId = profile.paypal_client_id;
    const secret = profile.paypal_secret;

    // ✅ Get access token
    const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

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
    const accessToken = tokenData.access_token;

    // ✅ Create PayPal order
    const orderRes = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: id,
              amount: {
                currency_code: "USD",
                value: Number(price || 1).toFixed(2),
              },
            },
          ],
          application_context: {
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/order-success-paypal?order_id=${id}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order-failed?order_id=${id}`,
          },
        }),
      }
    );

    const orderData = await orderRes.json();

    const approvalUrl = orderData.links?.find(
      (l: any) => l.rel === "approve"
    )?.href;

    if (!approvalUrl) {
      throw new Error("No PayPal approval URL found");
    }

    // ✅ Save order
    const { error } = await supabase.from("orders").upsert(
      [
        {
          id,
          bot_id,
          user_id,
          product_name,
          price,
          customer_email,
          phone,
          name,
          payment_status: "pending",
          payment_provider: "paypal",
          paypal_order_id: orderData.id,
        },
      ],
      { onConflict: "id" }
    );

    if (error) throw error;

    return NextResponse.json({
      success: true,
      payUrl: approvalUrl,
    });
  } catch (err: any) {
    console.error("PayPal API Error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}