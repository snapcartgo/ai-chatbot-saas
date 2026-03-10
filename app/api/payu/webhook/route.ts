import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 1. Initialize Supabase with Service Role Key (to bypass RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 2. PayU sends data as Form Data, not JSON
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // Extract necessary fields (Check PayU docs for exact naming)
    const { email, amount, status, productinfo } = data;

    // 3. Only update if the payment was successful
    if (status === 'success') {
      const plan = String(productinfo).toLowerCase();
      
      // Define limits based on plan
      const limits = {
        starter: { messages: 1000, chatbots: 1 },
        pro: { messages: 5000, chatbots: 5 },
      };

      const selected = limits[plan] || { messages: 100, chatbots: 1 };

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: plan,
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active"
        })
        .eq("user_email", email);

      if (error) {
        console.error("Supabase Error:", error);
        return NextResponse.json({ error: "DB Update Failed" }, { status: 500 });
      }
    }

    // 4. Always return 200 to PayU so they stop retrying
    return new NextResponse("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook Logic Error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// 5. Force this route to be dynamic (Required for Webhooks in Next.js)
export const dynamic = 'force-dynamic';