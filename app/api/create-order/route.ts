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
      user_id, // This is the ID of your Client (the store owner)
      product_name,
      price,
      customer_email
    } = body;

    // 1. FETCH CLIENT'S PAYU KEYS FROM PROFILES TABLE
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payu_merchant_key, payu_merchant_salt")
      .eq("id", user_id)
      .single();

    if (profileError || !profile?.payu_merchant_key) {
      return NextResponse.json({ error: "Client has not configured PayU keys" }, { status: 400 });
    }

    // 2. INSERT ORDER INTO DATABASE
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

    if (orderError) {
      console.error(orderError);
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // 3. GENERATE PAYU HASH DYNAMICALLY
    const txnid = order.id; // The UUID we just created
    const amount = parseFloat(price).toFixed(2);
    const firstname = customer_email.split("@")[0];
    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;

    // Hash Formula: key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString = `${key}|${txnid}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    // 4. RETURN EVERYTHING NEEDED FOR PAYU CHECKOUT
    return NextResponse.json({
      success: true,
      order_id: txnid,
      payu_data: {
        key: key,
        txnid: txnid,
        amount: amount,
        productinfo: product_name,
        firstname: firstname,
        email: customer_email,
        phone: "9999999999", // You can pass this from body if available
        surl: "https://ai-chatbot-saas-five.vercel.app/api/payu/webhook", // Update Webhook
        furl: "https://ai-chatbot-saas-five.vercel.app/payment-failed",
        hash: hash
      }
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}