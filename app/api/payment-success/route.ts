import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role to bypass RLS
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const status = formData.get('status');
    const txnid = formData.get('txnid'); // This is your Order ID

    console.log(`Payment status for ${txnid}: ${status}`);

    if (status === 'success') {
      // 1. Update the order status in Supabase
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', txnid);

      // 2. Redirect to a clean GET page (the visual success page)
      return NextResponse.redirect(new URL('/payment-confirmed', req.url), 303);
    }

    // If failed, send to a failure page
    return NextResponse.redirect(new URL('/payment-failed', req.url), 303);
  } catch (err) {
    console.error("Redirect Error:", err);
    return NextResponse.redirect(new URL('/', req.url), 303);
  }
}