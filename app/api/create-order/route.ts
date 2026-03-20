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

    // 🛡️ Get the ID from n8n (your ORD_... string)
    let {
      id, // This is the 'order_id' sent from n8n
      bot_id,
      user_id,
      product_name,
      price,
      customer_email,
      phone
    } = body;

    // 🛡️ AUTO-CLEAN IDs: Removes any "=" or spaces coming from n8n
    const cleanOrderId = id?.replace(/^=/, '').trim();
    const cleanUserId = user_id?.replace(/^=/, '').trim();
    const cleanBotId = bot_id?.replace(/^=/, '').trim();

    // 1️⃣ FETCH CLIENT PAYU KEYS
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("payu_merchant_key, payu_merchant_salt")
      .eq("id", cleanUserId)
      .maybeSingle();

    if (profileError || !profile?.payu_merchant_key) {
      console.error("Profile Fetch Error:", profileError);
      return NextResponse.json(
        { error: "Client keys not found in Profiles table." },
        { status: 400 }
      );
    }

    // 2️⃣ CREATE ORDER IN DATABASE
    // We pass 'id' explicitly so it doesn't try to generate a UUID
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          id: cleanOrderId, // 🟢 CRITICAL: Use the ID from n8n here
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
      console.error("Supabase Insert Error:", orderError);
      return NextResponse.json(
        { error: orderError?.message || "Order creation failed" },
        { status: 500 }
      );
    }

    // 3️⃣ GENERATE PAYU DATA
    const amount = parseFloat(price).toFixed(2);
    const firstname = customer_email ? customer_email.split("@")[0] : "Customer";
    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;
    const userPhone = phone || "9999999999";

    // MANDATORY HASH ORDER: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    // Note: We use the cleanOrderId as the txnid for PayU consistency
    const hashString = `${key}|${cleanOrderId}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    const payu_data = {
      key,
      txnid: cleanOrderId,
      amount,
      productinfo: product_name,
      firstname,
      email: customer_email,
      phone: userPhone,
      surl: `https://ai-chatbot-saas-five.vercel.app/api/payment-success?order_id=${cleanOrderId}`,
      furl: `https://ai-chatbot-saas-five.vercel.app/payment-failed`,
      service_provider: "payu_paisa",
      hash
    };

    // 4️⃣ SAVE PAYU DATA BACK TO THE ORDER
    await supabase
      .from("orders")
      .update({ payu_data })
      .eq("id", cleanOrderId);

    // 5️⃣ RETURN RESPONSE
    return NextResponse.json({
      success: true,
      order_id: cleanOrderId,
      payUrl: `https://ai-chatbot-saas-five.vercel.app/payu?order_id=${cleanOrderId}`,
      payu_data
    });

  } catch (err) {
    console.error("Critical API Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}