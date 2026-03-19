import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Required to bypass RLS for server-side updates
);

export async function POST(req: Request) {
  try {
    // PayU sends data as a standard Form POST
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // 1. Extract data from PayU response
    const { 
      txnid, 
      status, 
      hash: payuResponseHash, 
      email, 
      firstname, 
      productinfo, 
      amount, 
      mihpayid 
    } = data;

    // 2. CLEAN THE ID (Fixes the "ORD_" prefix issue)
    // If txnid is "ORD_f58b13ba_171000", this gets "f58b13ba"
    const orderUuid = (txnid as string).includes('_') 
      ? (txnid as string).split('_')[1] 
      : (txnid as string);

    // 3. Find the Merchant Salt associated with this order
    // We first get the user_id from the order, then the salt from that user's profile
    const { data: orderData, error: orderFetchError } = await supabase
      .from("orders")
      .select("user_id")
      .eq("id", orderUuid)
      .single();

    if (orderFetchError || !orderData) {
      console.error("Order not found in Supabase:", orderUuid);
      return NextResponse.redirect(new URL("/payment-failed?error=order_not_found", req.url), 303);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("payu_merchant_salt, payu_merchant_key")
      .eq("id", orderData.user_id)
      .single();

    if (!profile?.payu_merchant_salt) {
      throw new Error("Merchant salt not found for this user profile");
    }

    // 4. VERIFY HASH (Reverse Hash Check)
    // Formula: salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    const key = profile.payu_merchant_key;
    const salt = profile.payu_merchant_salt;
    
    // Note: We use 10 empty pipes for the UDFs exactly as PayU expects
    const checkString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    const calculatedHash = crypto.createHash("sha512").update(checkString).digest("hex");

    // 5. UPDATE DATABASE IF SUCCESSFUL
    if (status === "success" && calculatedHash === payuResponseHash) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ 
          payment_status: "success",
          // Store the PayU transaction ID for your records
          additional_info: { payu_mihpayid: mihpayid } 
        })
        .eq("id", orderUuid);

      if (updateError) throw updateError;

      // SUCCESS: Send them to the frontend success page
      return NextResponse.redirect(
        new URL(`/payment-success?order_id=${txnid}`, req.url),
        303
      );
    } else {
      console.warn("Hash mismatch or payment failed. Status:", status);
      return NextResponse.redirect(new URL("/payment-failed", req.url), 303);
    }

  } catch (err) {
    console.error("Payment Success Route Critical Error:", err);
    // If something crashes, we redirect to failed so the user doesn't see a blank screen
    return NextResponse.redirect(new URL("/payment-failed?error=internal_error", req.url), 303);
  }
}