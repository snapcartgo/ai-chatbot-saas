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

// 1. Prepare your variables first
const amount = parseFloat(price).toFixed(2);
const firstname = customer_email ? customer_email.split("@")[0] : "Customer";
const key = profile.payu_merchant_key;
const salt = profile.payu_merchant_salt;

// 2. GENERATE THE HASH (This fixes the 'generatedHash' error)
// The string must follow this exact order: key|txnid|amount|productinfo|firstname|email|||||||||||salt
const hashString = `${key}|${cleanOrderId}|${amount}|${product_name}|${firstname}|${customer_email}|||||||||||${salt}`;
const generatedHash = crypto.createHash("sha512").update(hashString).digest("hex");

// 3. Create the PayU Data object
const payu_data = {
  key,
  txnid: cleanOrderId,
  amount,
  productinfo: product_name,
  firstname,
  email: customer_email,
  phone: phone || "9999999999",
  surl: `https://${req.headers.get('host')}/api/payment-success?order_id=${cleanOrderId}`,
  furl: `https://${req.headers.get('host')}/payment-failed`,
  service_provider: "payu_paisa",
  hash: generatedHash // Now this variable exists!
};

// 4. Insert into Supabase with the payu_data included
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
    payu_data: payu_data // 🟢 THIS IS THE KEY TO REMOVING THE LOADING SCREEN
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