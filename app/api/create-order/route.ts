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

    const { id, bot_id, user_id, product_name, price, customer_email, phone } = body;

    // 1. Clean IDs
    const cleanOrderId = id?.replace(/^=/, '').trim();
    const cleanUserId = user_id?.replace(/^=/, '').trim();

    // 2. Fetch Keys from Profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("payu_merchant_key, payu_merchant_salt")
      .eq("id", cleanUserId)
      .maybeSingle();

    if (!profile?.payu_merchant_key) {
      return NextResponse.json({ error: "Merchant keys not found" }, { status: 400 });
    }

    // 3. Prepare Variables
    // ... existing imports (crypto, supabase, etc.)

  // 1. First, calculate the hash string
const amount = parseFloat(price).toFixed(2);
const firstname = customer_email ? customer_email.split("@")[0] : "Customer";
const key = profile.payu_merchant_key;
const salt = profile.payu_merchant_salt;

// Formula: key|txnid|amount|productinfo|firstname|email|||||||||||salt
const hashString = `${key}|${cleanOrderId}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;

// 2. Create the actual hash variable (This fixes your "Cannot find name" error)
const generatedHash = crypto.createHash("sha512").update(hashString).digest("hex");

// 3. Put that hash INTO the payu_data object
const payu_data = {
  key,
  txnid: cleanOrderId,
  amount,
  productinfo: product_name,
  firstname,
  email: customer_email,
  phone: phone || "9999999999",
  surl: `https://ai-chatbot-saas-five.vercel.app//api/payment-success`,
  furl: `https://ai-chatbot-saas-five.vercel.app//api/payment-success`,
  service_provider: "payu_paisa",
  hash: generatedHash 
};

// 4. SAVE IT TO SUPABASE (This is the most important part)
const { error: orderError } = await supabase
  .from("orders")
  .insert([{
    id: cleanOrderId,
    bot_id: bot_id?.replace(/^=/, '').trim(),
    user_id: cleanUserId,
    product_name,
    price: parseFloat(price),
    customer_email,
    payment_status: "pending",
    payu_data: payu_data // This column must NOT be NULL in Supabase
  }]);

    if (orderError) throw orderError;

    return NextResponse.json({
      success: true,
      payUrl: `https://${req.headers.get('host')}/payu?order_id=${cleanOrderId}`
    });

  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}