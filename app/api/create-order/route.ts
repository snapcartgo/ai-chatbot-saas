import { createClient } from '@supabase/supabase-js'; // Or your local supabase config

export async function POST(req: Request) {
  const { user_id, bot_id, product_name, price, customer_email } = await req.json();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await supabase
    .from('orders')
    .insert([
      {
        user_id,
        bot_id,
        product_name,
        price,
        customer_email,
        payment_status: 'pending', // Always start as pending
      }
    ])
    .select();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { status: 200 });
}