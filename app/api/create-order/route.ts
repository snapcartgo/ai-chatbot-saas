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

    let {
      bot_id,
      user_id,
      product_name,
      price,
      customer_email
    } = body;

    // 🛡️ AUTO-CLEAN IDs: Removes any "=" or spaces coming from n8n
    const cleanUserId = user_id?.replace(/^=/, '').trim();
    const cleanBotId = bot_id?.replace(/^=/, '').trim();

    // 1️⃣ FETCH CLIENT PAYU KEYS
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payu_merchant_key, payu_merchant_salt")
      .eq("id", cleanUserId)
      .maybeSingle(); // Better than .single() - won't crash if empty

    if (profileError || !profile?.payu_merchant_key) {
      console.error("Profile Fetch Error:", profileError);
      return NextResponse.json(
        { error: "Client keys not found. Check if User ID exists in Profiles table." },
        { status: 400 }
      );
    }

    // 2️⃣ CREATE ORDER IN DATABASE
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          bot_id: cleanBotId,
          user_id: cleanUserId,
          product_name: product_name || "AI Service",
          price: parseFloat(price) || 0,
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
    const txnid = `ORD_${order.id.slice(0, 8)}_${Date.now()}`;
    const amount = parseFloat(price).toFixed(2);
    const firstname = customer_email ? customer_email.split("@")[0] : "Customer";
    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;

    // MANDATORY HASH ORDER: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    const hashString = `${key}|${txnid}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    // 4️⃣ RETURN DATA
    return NextResponse.json({
      success: true,
      order_id: txnid,
      payUrl: `https://ai-chatbot-saas-five.vercel.app/payu?order_id=${txnid}`, // Redirect user here
      payu_data: {
        key,
        txnid,
        amount,
        productinfo: product_name,
        firstname,
        email: customer_email,
        phone: "9999999999",
        surl: `https://ai-chatbot-saas-five.vercel.app/api/payment-success`,
        furl: `https://ai-chatbot-saas-five.vercel.app/payment-failed`,
        service_provider: "payu_paisa", // REQUIRED for India
        hash
      }
    });

  } catch (err) {
    console.error("Critical API Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}