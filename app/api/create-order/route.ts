import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypasses RLS
    );

    // Prepare the insert object
    const insertData = {
      user_id: body.user_id,
      bot_id: body.bot_id,
      product_name: body.product_name,
      price: body.price,
      customer_email: body.customer_email,
      payment_status: body.payment_status || 'pending',
    };

    const { data, error } = await supabase
      .from('orders')
      .insert([insertData])
      .select();

    if (error) {
      console.error("SUPABASE ERROR:", error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err: any) {
    console.error("CRASH:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}