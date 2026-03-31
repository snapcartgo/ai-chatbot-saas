import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const paypalOrderId = searchParams.get("token"); // PayPal sends this
    const orderId = searchParams.get("order_id");

    if (!paypalOrderId || !orderId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    // ✅ Get user credentials from DB
    const { data: order } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", order.user_id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "PayPal credentials missing" },
        { status: 400 }
      );
    }

    const clientId = profile.paypal_client_id;
    const secret = profile.paypal_secret;

    // ✅ STEP 1: Get Access Token
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

    // ✅ STEP 2: CAPTURE PAYMENT (🔥 VERY IMPORTANT)
    const captureRes = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureRes.json();

    if (captureData.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    // ✅ STEP 3: Update DB
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        paypal_capture_data: captureData,
      })
      .eq("id", orderId);

    // ✅ STEP 4: Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/success?order_id=${orderId}`
    );
  } catch (err: any) {
    console.error("PayPal Success Error:", err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}