import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { order_id, utr_number } = await req.json();

    if (!order_id || !utr_number) {
      return NextResponse.json({ error: 'Missing Order ID or UTR' }, { status: 400 });
    }

    // Update the order with the proof of payment
    const { error } = await supabaseAdmin
      .from('orders')
      .update({ 
        utr_reference: utr_number,
        verification_status: 'pending',
        payment_status: 'pending' // Keeps it pending until you verify
      })
      .eq('id', order_id);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: "Payment proof submitted. We will verify this shortly!" 
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to submit proof' }, { status: 500 });
  }
}