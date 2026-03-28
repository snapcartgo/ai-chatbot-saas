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

    const cleanOrderId = id?.trim();
    const cleanUserId = user_id?.trim();

    // ✅ Fetch merchant keys
    const { data: profile } = await supabase
      .from("profiles")
      .select("payu_merchant_key, payu_merchant_salt")
      .eq("id", cleanUserId)
      .single();

    if (!profile?.payu_merchant_key) {
      return NextResponse.json({ error: "Merchant keys not found" }, { status: 400 });
    }

    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;

    // ✅ REQUIRED FORMATTING
    const amount = Number(price).toFixed(2);
    const firstname = customer_email?.split("@")[0] || "Customer";
    const email = customer_email || "";
    const productinfo = product_name || "Product";

    // ✅ CORRECT HASH FORMAT
    const hashString =
      key +
      "|" +
      cleanOrderId +
      "|" +
      amount +
      "|" +
      productinfo +
      "|" +
      firstname +
      "|" +
      email +
      "|||||||||||" +
      salt;

    const generatedHash = crypto
      .createHash("sha512")
      .update(hashString)
      .digest("hex");

    // ✅ FINAL PAYU DATA
    const payu_data = {
      key,
      txnid: cleanOrderId,
      amount,
      productinfo,
      firstname,
      email,
      phone: phone || "9999999999",

      // ✅ IMPORTANT (FIXED)
      surl: `https://ai-chatbot-saas-five.vercel.app/api/order-success`,
      furl: `https://ai-chatbot-saas-five.vercel.app/order-failed?order_id=${cleanOrderId}`,

     

      service_provider: "payu_paisa",
      hash: generatedHash,
    };

    // ✅ SAVE ORDER
    const { error } = await supabase.from("orders").insert([
      {
        id: cleanOrderId,
        bot_id,
        user_id: cleanUserId,
        product_name,
        price: Number(price),
        customer_email,
        payment_status: "pending",
        payu_data,
      },
    ]);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      payUrl: `https://${req.headers.get("host")}/payu?order_id=${cleanOrderId}`,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}