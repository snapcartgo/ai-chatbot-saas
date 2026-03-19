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

    // 🛡️ SERVER-SIDE SANITIZATION (Fixes the 22P02 Error)
    // This removes leading "=" or whitespace from the IDs sent by n8n
    const sanitizeId = (id: string) => id?.replace(/^=/, '').trim();
    
    const cleanUserId = sanitizeId(user_id);
    const cleanBotId = sanitizeId(bot_id);

    console.log("DEBUG -> Raw User ID:", user_id);
    console.log("DEBUG -> Clean User ID:", cleanUserId);

    // 1️⃣ FETCH CLIENT PAYU KEYS
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("payu_merchant_key, payu_merchant_salt")
        .eq("id", cleanUserId) // Use the cleaned ID here
        .maybeSingle();

    if (profileError || !profile?.payu_merchant_key) {
      console.error("Profile Error:", profileError);
      return NextResponse.json(
        { error: "Client has not configured PayU keys or User ID is invalid" },
        { status: 400 }
      );
    }

    // 2️⃣ CREATE ORDER
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          bot_id: cleanBotId, // Use the cleaned ID here
          user_id: cleanUserId, // Use the cleaned ID here
          product_name,
          price: parseFloat(price),
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

    // Hash Logic: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    const hashString = `${key}|${txnid}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    // 4️⃣ RETURN PAYU DATA + PAY PAGE URL
    return NextResponse.json({
      success: true,
      order_id: txnid,
      payUrl: `https://ai-chatbot-saas-five.vercel.app/payu?order_id=${txnid}`,
      payu_data: {
        key,
        txnid,
        amount,
        productinfo: product_name,
        firstname,
        email: customer_email,
        phone: "9999999999", 
        surl: `https://ai-chatbot-saas-five.vercel.app/api/payment-success?order_id=${txnid}`,
        furl: "https://ai-chatbot-saas-five.vercel.app/payment-failed",
        service_provider: "payu_paisa",
        hash
      }
    });

  } catch (err) {
    console.error("Critical Server Error:", err);
    return NextResponse.json(
      { error: "Server error occurred during order creation" },
      { status: 500 }
    );
  }
}