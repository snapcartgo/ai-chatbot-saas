import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const status = formData.get('status');
    const orderId = formData.get('txnid'); // This matches your 'cleanOrderId'

    if (status === 'success') {
      // Update Supabase to mark the order as paid
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);

      // Redirect the user to a visual success page
      return NextResponse.redirect(new URL('/payment-confirmed', req.url), 303);
    }

    return NextResponse.redirect(new URL('/payment-failed', req.url), 303);
  } catch (err) {
    console.error("Success Redirect Error:", err);
    return NextResponse.redirect(new URL('/', req.url), 303);
  }
}