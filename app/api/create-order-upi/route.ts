// app/api/create-order-upi/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase with Service Role Key for admin access to private tables
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order_id, bot_id, user_id, amount, email } = body;

    // 1. Validation
    if (!order_id || !bot_id || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Fetch bot-specific payment settings from the private table
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('bot_payment_settings')
      .select('upi_vpa, merchant_name')
      .eq('bot_id', bot_id)
      .single();

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'Payment settings not found for this bot' }, { status: 404 });
    }

    // 3. Generate the standard UPI Deep Link (RFC compliant)
    // pa: Virtual Payment Address (VPA)
    // pn: Merchant Name
    // am: Amount
    // cu: Currency (INR)
    // tn: Transaction Note (includes Order ID for reconciliation)
    const upiLink = `upi://pay?pa=${settings.upi_vpa}&pn=${encodeURIComponent(
      settings.merchant_name
    )}&am=${amount}&cu=INR&tn=ORDER-${order_id}`;

    // 4. Update or Insert the order with 'pending' status and UPI data
    const { error: orderError } = await supabaseAdmin
      .from('orders')
      .upsert({
        id: order_id,
        bot_id,
        user_id,
        amount,
        customer_email: email,
        payment_status: 'pending',
        payment_method: 'upi',
        upi_data: { vpa: settings.upi_vpa, intent_url: upiLink },
        created_at: new Date().toISOString(),
      });

    if (orderError) {
      console.error('Order Update Error:', orderError);
      return NextResponse.json({ error: 'Failed to initialize order' }, { status: 500 });
    }

    // 5. Construct the formatted instructions for the KB placeholder
    const instructions = `
✅ **Manual Payment Required**
Please complete your payment of **₹${amount}** to proceed.

1. **Pay via UPI:** [Click here to open your UPI App](${upiLink})
2. **Merchant:** ${settings.merchant_name}
3. **Note:** Please ensure "ORDER-${order_id}" is in the payment remarks.

**Once paid, please reply with your UTR / Transaction ID.**
    `.trim();

    return NextResponse.json({
      success: true,
      upi_link: upiLink,
      instructions: instructions,
      order_id: order_id
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}