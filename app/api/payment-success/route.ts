import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-chatbot-saas-five.vercel.app';
  const successUrl = `${baseUrl}/dashboard?payment=success`;
  const errorUrl = `${baseUrl}/pricing?payment=failed`;

  try {
    const formData = await req.formData();

    const status = formData.get('status');
    const email = (formData.get('email') || formData.get('udf1') || "")
      .toString()
      .toLowerCase()
      .trim();

    const amount = Number(formData.get('amount') || 0);
    const plan = (formData.get('udf2') || "growth").toString(); 
    const txnid = formData.get('txnid')?.toString() || ""; // Get PayU Transaction ID

    console.log("Processing payment for:", email, "Status:", status, "TXNID:", txnid);

    if (status !== "success") {
      return NextResponse.redirect(errorUrl, { status: 303 });
    }

    // ----------------------------------
    // ✅ STEP 1: UPDATE ORDERS TABLE (The one in your screenshot)
    // ----------------------------------
    const { error: orderError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        payment_id: txnid,
      })
      .eq("customer_email", email)
      .eq("payment_status", "pending"); // Only update the pending one

    if (orderError) {
      console.error("Orders Table Update Error:", orderError.message);
    } else {
      console.log("Orders table updated to paid ✅");
    }

    // ----------------------------------
    // ✅ STEP 2: GET USER ID FROM PROFILES
    // ----------------------------------
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found ❌");
      return NextResponse.redirect(successUrl, { status: 303 });
    }

    const uid = profile.id;

    // ----------------------------------
    // ✅ STEP 3: UPDATE SUBSCRIPTIONS
    // ----------------------------------
    const { error: subError } = await supabase
      .from("subscriptions")
      .update({
        amount: amount,
        status: "active",
      })
      .match({
        user_id: uid,
        plan: plan,
      });

    if (subError) console.error("Subscription Error:", subError.message);

    // ----------------------------------
    // ✅ STEP 4: UPDATE REFERRALS
    // ----------------------------------
    const commission = amount * 0.2;
    const { data: refCheck } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_user_id", uid)
      .maybeSingle();

    if (refCheck) {
      await supabase
        .from("referrals")
        .update({
          amount: amount,
          commission_amount: commission,
          payment_status: "paid",
          status: "completed",
        })
        .eq("referred_user_id", uid);
    }

    // ----------------------------------
    // ✅ FINAL REDIRECT
    // ----------------------------------
    return NextResponse.redirect(successUrl, { status: 303 });

  } catch (err) {
    console.error("Payment API Error:", err);
    return NextResponse.redirect(errorUrl, { status: 303 });
  }
}