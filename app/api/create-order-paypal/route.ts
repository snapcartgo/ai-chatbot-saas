import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { id, user_id, price } = body;

    if (!id || !user_id) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

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
      throw new Error("PayPal token failed");
    }

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
      throw new Error("No approval URL");
    }

    return NextResponse.json({
      success: true,
      payUrl: approvalUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}