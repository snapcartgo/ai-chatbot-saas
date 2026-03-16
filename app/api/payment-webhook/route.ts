import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  const formData = await req.formData();
  const status = formData.get('status'); // PayU sends 'success' or 'failure'
  const txnid = formData.get('txnid');   // This should match a unique ID you sent to PayU
  const email = formData.get('email');

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (status === 'success') {
    const { error } = await supabase
      .from('orders')
      .update({ 
        payment_status: 'successful',
        payment_id: formData.get('mihpayid') // PayU's transaction ID
      })
      .eq('customer_email', email)
      .eq('payment_status', 'pending'); // Safety check

    if (error) console.error('Supabase Update Error:', error);
  }

  return new Response('Webhook Received', { status: 200 });
}