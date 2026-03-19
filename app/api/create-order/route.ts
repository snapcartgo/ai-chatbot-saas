import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      bot_id,
      user_id,
      product_name,
      price,
      customer_email
    } = body;

    // 1️⃣ FETCH CLIENT PAYU KEYS
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payu_merchant_key, payu_merchant_salt")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.payu_merchant_key) {
      return NextResponse.json(
        { error: "Client has not configured PayU keys" },
        { status: 400 }
      );
    }

    // 2️⃣ CREATE ORDER
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          bot_id,
          user_id,
          product_name,
          price,
          customer_email,
          payment_status: "pending"
        }
      ])
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Order creation failed" },
        { status: 500 }
      );
    }

    // 3️⃣ GENERATE PAYU DATA
    const txnid = order.id;
    const amount = parseFloat(price).toFixed(2);
    const firstname = customer_email.split("@")[0];

    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;

    const hashString = `${key}|${txnid}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    // 4️⃣ RETURN PAYU DATA + PAY PAGE URL
    return NextResponse.json({
      success: true,
      order_id: txnid,

      // 🔥 THIS IS IMPORTANT FOR n8n
      payUrl: `https://ai-chatbot-saas-five.vercel.app/payu?order_id=${txnid}`,

      payu_data: {
        key,
        txnid,
        amount,
        productinfo: product_name,
        firstname,
        email: customer_email,
        phone: "9999999999",

        // 🔥 IMPORTANT CHANGE
        surl: `https://ai-chatbot-saas-five.vercel.app/api/payment-success?order_id=${txnid}`,
        furl: "https://ai-chatbot-saas-five.vercel.app/payment-failed",

        hash
      }
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}