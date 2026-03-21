import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers'; // This imports the cookie helper

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Incoming Order Data:", body);

   // 1. Get the cookie store
    const cookieStore = await cookies(); 
    
    // 2. Get the referral code (using the proper check)
    const referralCode = cookieStore.get('referral_code')?.value;

    // YOUR existing Supabase connection
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Insert the order (Your original logic)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        {
          user_id: body.user_id,
          bot_id: body.bot_id,
          product_name: body.product_name,
          price: body.price,
          customer_email: body.customer_email,
          payment_status: 'pending' 
        }
      ])
      .select()
      .single();

    if (orderError) {
      console.error("Supabase Error:", orderError);
      return NextResponse.json({ error: orderError.message }, { status: 400 });
    }

    // 2. PARTNER LOGIC: If a referral code exists in the cookie
    if (referralCode) {
      // Find the partner who owns this code
      const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('referral_code', referralCode)
        .single();

      if (partner) {
        // Link this referral to the partner in the 'referrals' table
        await supabase.from('referrals').insert([
          {
            partner_id: partner.id,
            referred_email: body.customer_email,
            status: 'pending' 
          }
        ]);
      }
    }

    return NextResponse.json({ success: true, data: orderData }, { status: 200 });

  } catch (err: any) {
    console.error("Server Crash:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}