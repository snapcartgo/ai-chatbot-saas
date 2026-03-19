import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role to bypass RLS
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // 1. Extract necessary data from PayU response
    const { txnid, status, hash, email, firstname, productinfo, amount, mihpayid } = data;
    
    // We need the order_id (which is txnid) to find the user's salt
    // In your create-order, txnid looks like: ORD_orderid_timestamp
    // Let's extract the actual Supabase Order UUID
    const orderUuid = (txnid as string).split('_')[1];

    // 2. Fetch the merchant salt to verify the hash
    const { data: orderData } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderUuid)
      .single();

    const { data: profile } = await supabase
      .from("profiles")
      .select("payu_merchant_salt, payu_merchant_key")
      .eq("id", orderData?.user_id)
      .single();

    if (!profile) throw new Error("Merchant keys not found");

    // 3. Verify Hash (Reverse Hash Check)
    // PayU Success Hash Formula: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;
    const checkString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    const calculatedHash = crypto.createHash("sha512").update(checkString).digest("hex");

    // 4. Update Supabase if payment is successful
    if (status === "success") {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ 
          payment_status: "success",
          payu_mihpayid: mihpayid // Store PayU's transaction ID for reference
        })
        .eq("id", orderUuid);

      if (updateError) throw updateError;

      // 5. Redirect user to a success page on your frontend
      return NextResponse.redirect(
        new URL(`/payment-success?order_id=${txnid}`, req.url),
        303
      );
    }

    return NextResponse.redirect(new URL("/payment-failed", req.url), 303);

  } catch (err) {
    console.error("Payment Success Route Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}