import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // ✅ PayU sends formData (IMPORTANT)
    const formData = await req.formData();

    const status = formData.get('status');
    const email = (formData.get('email') || formData.get('udf1') || "")
      .toString()
      .toLowerCase()
      .trim();

    const amount = Number(formData.get('amount') || 0);
    const plan = (formData.get('udf2') || "growth").toString(); // plan name

    console.log("Status:", status);
    console.log("Email:", email);
    console.log("Amount:", amount);
    console.log("Plan:", plan);

    if (status !== "success") {
      return NextResponse.json({ success: false });
    }


const orderId = formData.get("txnid"); // PayU order id

console.log("Order ID:", orderId);

if (orderId) {
  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: "paid",
      payment_status: "paid",
    })
    .eq("order_id", orderId);

  if (orderError) {
    console.error("Order Update Error:", orderError.message);
  } else {
    console.log("Order marked as PAID ✅");
  }
}

    // ----------------------------------
    // ✅ STEP 1: GET USER FROM PROFILES
    // ----------------------------------
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found ❌");
      return NextResponse.json({ success: false });
    }

    const uid = profile.id;

    console.log("UID:", uid);

    // ----------------------------------
    // ✅ STEP 2: UPDATE SUBSCRIPTIONS
    // ----------------------------------
    const { error: subError } = await supabase
      .from("subscriptions")
      .update({
        amount: amount,
        status: "active",
      })
      .match({
        user_id: uid,
        plan: plan, // 🔥 IMPORTANT
      });

    if (subError) {
      console.error("Subscription Error:", subError.message);
    } else {
      console.log("Subscription updated ✅");
    }

    // ----------------------------------
    // ✅ STEP 3: UPDATE REFERRALS
    // ----------------------------------
    const commission = amount * 0.2;

    const { data: refCheck } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_user_id", uid)
      .maybeSingle();

    if (refCheck) {
      const { error: refError } = await supabase
        .from("referrals")
        .update({
          amount: amount,
          commission_amount: commission,
          payment_status: "paid",
          status: "completed",
        })
        .eq("referred_user_id", uid);

      if (refError) {
        console.error("Referral Error:", refError.message);
      } else {
        console.log("Referral updated ✅");
      }
    }

    // ----------------------------------
    // ✅ RESPONSE
    // ----------------------------------
    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Payment API Error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}