import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const id = body.id ?? body.order_id;
    const user_id = body.user_id ?? body.userId;
    const bot_id = body.bot_id ?? body.botId ?? null;
    const product_name = body.product_name ?? body.productName;
    const customer_email = body.customer_email ?? body.email;
    const name = body.name ? String(body.name).trim() : null;
    const rawPhone = body.phone ?? null;
    const currency = (body.currency ?? "USD").toString().toUpperCase();
    const parsedPrice = Number(body.price);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    const phoneString =
      rawPhone === null || rawPhone === undefined || rawPhone === ""
        ? null
        : String(rawPhone).replace(/\D/g, "");

    const phone =
      phoneString && phoneString.length > 0 ? Number(phoneString) : null;

    if (
      !id ||
      !user_id ||
      !product_name ||
      !customer_email ||
      Number.isNaN(parsedPrice) ||
      parsedPrice <= 0
    ) {
      return NextResponse.json(
        {
          error: "Missing or invalid required fields",
          received: {
            id,
            user_id,
            product_name,
            customer_email,
            price: body.price,
            name,
            rawPhone,
          },
        },
        { status: 400 }
      );
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_BASE_URL is not configured" },
        { status: 500 }
      );
    }

    if (rawPhone && (phone === null || Number.isNaN(phone))) {
      return NextResponse.json(
        {
          error: "Invalid phone number",
          raw_phone: rawPhone,
        },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.paypal_client_id || !profile?.paypal_secret) {
      return NextResponse.json(
        {
          error: "PayPal credentials not found",
          profile_error: profileError,
          user_id,
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
          error: "PayPal token generation failed",
          paypal: tokenData,
        },
        { status: 500 }
      );
    }

    const paypalPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: String(id),
          amount: {
            currency_code: currency,
            value: parsedPrice.toFixed(2),
          },
          description: product_name,
        },
      ],
      application_context: {
        brand_name: "AI SaaS",
        user_action: "PAY_NOW",
        return_url: `${baseUrl}/api/order-success-paypal?order_id=${id}`,
        cancel_url: `${baseUrl}/order-failed?order_id=${id}`,
      },
    };

    const orderRes = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paypalPayload),
      }
    );

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      return NextResponse.json(
        {
          error: "PayPal order creation failed",
          paypal: orderData,
          request_payload: paypalPayload,
        },
        { status: 500 }
      );
    }

    const approvalUrl =
      orderData.links?.find((l: any) => l.rel === "approve")?.href ?? null;

    const insertPayload = {
      id: String(id),
      user_id,
      bot_id,
      product_name,
      price: parsedPrice,
      payment_status: "pending",
      payment_id: orderData.id ?? null,
      customer_email,
      name,
      phone,
      payment_link: approvalUrl,
      paypal_data: JSON.stringify(orderData),
      payu_data: null,
    };

    const { data: insertedOrder, error: insertError } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error: "Supabase insert failed",
          supabase_error: insertError.message,
          supabase_details: insertError.details,
          supabase_hint: insertError.hint,
          insert_payload: insertPayload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order_saved: true,
      order: insertedOrder,
      payment_link: approvalUrl,
      paypal_order_id: orderData.id,
      payment_id: orderData.id,
      order_id: id,
      phone,
      name,
      payment_gateway: "PayPal",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
