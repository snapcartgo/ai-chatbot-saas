import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      session_id, 
      bot_id, 
      phone, 
      email, 
      payment_status = 'COD', 
      order_status = 'Active' 
    } = body;

    if (!session_id) {
      return NextResponse.json(
        { success: false, message: 'session_id is required' },
        { status: 400 }
      );
    }

    // Build the query with strict multi-column matching
    let query = supabase
      .from('orders')
      .update({
        payment_status: payment_status,
        order_status: order_status,
      })
      .eq('session_id', session_id)
      .eq('payment_status', 'pending'); // Only update pending orders

    // Match bot_id if provided
    if (bot_id) {
      query = query.eq('bot_id', bot_id);
    }

    // Match phone or email for extra security verification
    if (phone) {
      query = query.eq('phone', phone);
    } else if (email) {
      query = query.eq('customer_email', email);
    }

    const { data, error } = await query.select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No matching pending order found to update for this session and customer.' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Your order for ${data[0].product_name || 'your items'} has been confirmed with Cash on Delivery!`,
      order: data[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}