import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  // Define your frontend success/error URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-chatbot-saas-five.vercel.app';
  const successUrl = `${baseUrl}/dashboard?payment=success`;
  const errorUrl = `${baseUrl}/pricing?payment=failed`;

  try {
    // ✅ PayU sends formData
    const formData = await req.formData();

    const status = formData.get('status');
    const email = (formData.get('email') || formData.get('udf1') || "")
      .toString()
      .toLowerCase()
      .trim();

    const amount = Number(formData.get('amount') || 0);
    const plan = (formData.get('udf2') || "growth").toString(); 

    console.log("Processing payment for:", email, "Status:", status);

    // If payment failed at PayU, send user to error page
    if (status !== "success") {
      return NextResponse.redirect(errorUrl, { status: 303 });
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
      // Still redirect so the user isn't stuck on a white screen
      return NextResponse.redirect(errorUrl, { status: 303 });
    }

    const uid = profile.id;

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
        plan: plan,
      });

    if (subError) console.error("Subscription Error:", subError.message);

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
    // ✅ FINAL STEP: REDIRECT TO UI
    // ----------------------------------
    // This moves the user from the "API screen" to your actual Website UI
    return NextResponse.redirect(successUrl, { status: 303 });

  } catch (err) {
    console.error("Payment API Error:", err);
    return NextResponse.redirect(errorUrl, { status: 303 });
  }
}