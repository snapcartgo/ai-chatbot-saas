import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const normalizedId = body.id ?? body.order_id;
    const normalizedUserId = body.user_id ?? body.userId;
    const normalizedPrice = body.price;
    const normalizedProductName = body.product_name ?? body.productName;
    const normalizedCustomerEmail = body.customer_email ?? body.email;
    const normalizedPhone = body.phone;
    const normalizedName = body.name;
    const normalizedBotId = body.bot_id ?? body.botId;
    const normalizedCurrency = (body.currency ?? "USD").toString().toUpperCase();

    const {
      id = normalizedId,
      user_id = normalizedUserId,
      price = normalizedPrice,
      product_name = normalizedProductName,
      customer_email = normalizedCustomerEmail,
      phone = normalizedPhone,
      name = normalizedName,
      bot_id = normalizedBotId,
    } = body;

    const parsedPrice = Number(price);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    // 1. Check for basic fields
    if (!id || !user_id || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json({ error: "Missing id, user_id, or price" }, { status: 400 });
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_BASE_URL is not configured" },
        { status: 500 }
      );
    }

    // 2. Fetch Credentials
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paypal_client_id, paypal_secret")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.paypal_client_id) {
      return NextResponse.json({ error: "PayPal credentials not found" }, { status: 400 });
    }

    // 3. PayPal Auth
    const auth = Buffer.from(`${profile.paypal_client_id}:${profile.paypal_secret}`).toString("base64");
    const tokenRes = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error("PayPal Token Failed");

    // 4. Create Order (Schema Optimized)
    const orderRes = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: id.toString(),
          amount: {
            currency_code: normalizedCurrency,
            value: parsedPrice.toFixed(2), // Force string "X.XX"
          }
        }],
        application_context: {
          brand_name: "AI SaaS",
          user_action: "PAY_NOW",
          return_url: `${baseUrl}/api/order-success-paypal?order_id=${id}`,
          cancel_url: `${baseUrl}/order-failed`,
        }
      }),
    });

    const orderData = await orderRes.json();

    if (!orderRes.ok) {
      console.error("PayPal Schema Error Details:", JSON.stringify(orderData, null, 2));
      return NextResponse.json(
        {
          error: "PayPal order creation failed",
          paypal: orderData,
          request_payload: {
            id,
            user_id,
            price: parsedPrice,
            currency: normalizedCurrency,
            return_url: `${baseUrl}/api/order-success-paypal?order_id=${id}`,
            cancel_url: `${baseUrl}/order-failed`,
          },
        },
        { status: 500 }
      );
    }

    const approvalUrl = orderData.links?.find((l: any) => l.rel === "approve")?.href;

    // 5. Database Save
    await supabase.from("orders").insert({
      order_id: id,
      user_id,
      product_name,
      price: parsedPrice,
      customer_email,
      payment_link: approvalUrl,
      status: "pending",
      bot_id
    });

    return NextResponse.json({ success: true, payment_link: approvalUrl });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
