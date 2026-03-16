import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {

  const body = await req.json();

  const { userId, botId, planName, price, email } = body;

  if (!userId || !botId || !planName || !price || !email) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400 }
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // STEP 1: Create order with pending status

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      bot_id: botId,
      product_name: planName,
      price: price,
      payment_status: "pending",
      customer_email: email
    })
    .select()
    .single();

  if (error) {
    console.error("Order insert error:", error);

    return new Response(
      JSON.stringify({ error: "Failed to create order" }),
      { status: 500 }
    );
  }

  const orderId = order.id;

  // STEP 2: Create payment URL (example)

  const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payu?order_id=${orderId}&amount=${price}&email=${email}`;

  return new Response(
    JSON.stringify({
      success: true,
      orderId: orderId,
      paymentUrl: paymentUrl
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}