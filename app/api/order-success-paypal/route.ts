import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const paypalOrderId = searchParams.get("token");
    const orderId = searchParams.get("order_id");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!paypalOrderId || !orderId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_BASE_URL is not configured" },
        { status: 500 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, paypal_data, payu_data")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        {
          error: "Order not found",
          details: orderError,
          order_id: orderId,
        },
        { status: 404 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", order.user_id)
      .single();

    if (profileError || !profile?.paypal_client_id || !profile?.paypal_secret) {
      return NextResponse.json(
        {
          error: "PayPal credentials missing",
          profile_error: profileError,
        },
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

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json(
        {
          error: "Failed to get PayPal access token",
          paypal: tokenData,
        },
        { status: 500 }
      );
    }

    const captureRes = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${paypalOrderId}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      return NextResponse.json(
        {
          error: "PayPal capture failed",
          paypal: captureData,
        },
        { status: 500 }
      );
    }

    const captureId =
      captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
      paypalOrderId;

    const completed =
      captureData.status === "COMPLETED" ||
      captureData.purchase_units?.[0]?.payments?.captures?.[0]?.status ===
        "COMPLETED";

    if (!completed) {
      return NextResponse.json(
        {
          error: "Payment not completed",
          paypal: captureData,
        },
        { status: 400 }
      );
    }

    let existingPaypalData: any = {};
    try {
      existingPaypalData = order.paypal_data
        ? typeof order.paypal_data === "string"
          ? JSON.parse(order.paypal_data)
          : order.paypal_data
        : {};
    } catch {
      existingPaypalData = {};
    }

    const mergedPaypalData = {
      ...existingPaypalData,
      provider: "paypal",
      paypal_order_id: paypalOrderId,
      paypal_capture_id: captureId,
      paypal_capture_response: captureData,
    };

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_id: captureId,
        paypal_data: JSON.stringify(mergedPaypalData),
      })
      .eq("id", orderId);

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to update order in Supabase",
          supabase: updateError,
        },
        { status: 500 }
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/order-success?order_id=${orderId}`
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
