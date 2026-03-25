import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // ✅ Get data from frontend (NOT formData anymore)
    const body = await req.json();

    const uid = body.uid;              // 🔥 USER ID (MAIN FIX)
    const planPrice = Number(body.amount || 0);

    console.log("UID received:", uid);
    console.log("Plan Price:", planPrice);

    if (!uid) {
      throw new Error("UID missing");
    }

    // 1. Calculate commission
    let commission = 0;
    let statusText = "free";

    if (planPrice > 0) {
      const commissionPercent = 20;
      commission = (planPrice * commissionPercent) / 100;
      statusText = "completed";
    }

    // 2. Check referral
    const { data: refCheck, error: checkError } = await supabase
      .from('referrals')
      .select('*')
      .eq('referred_user_id', uid)
      .maybeSingle();

    console.log("Referral Found:", refCheck);

    if (checkError) {
      console.error("Check Error:", checkError.message);
    }

    if (refCheck) {
      // 3. Update referral
      const { error: refError } = await supabase
        .from('referrals')
        .update({
          amount: planPrice,
          commission_amount: commission,
          payment_status: planPrice > 0 ? 'paid' : 'free',
          status: statusText,
        })
        .eq('referred_user_id', uid);

      if (refError) {
        console.error("Referral Update Error:", refError.message);
      } else {
        console.log("Referral updated successfully ✅");
      }
    } else {
      console.log("No referral found for this user ❌");
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("Payment API Error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}