import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role to bypass RLS
);



export async function POST(req: Request) {
  try {
    // 1. PayU sends data as Form Data (URL encoded)
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    console.log("PayU Webhook Received:", data);

    const email = data.email as string;
    const status = data.status as string; 
    const planName = (data.productinfo as string || "starter").toLowerCase();

    if (status === 'success') {
      const limits: Record<string, { messages: number; chatbots: number }> = {
        starter: { messages: 1000, chatbots: 1 },
        pro: { messages: 5000, chatbots: 5 },
        growth: { messages: 20000, chatbots: 20 },
      };

      const selected = limits[planName] || limits["starter"];

      // 2. IMPORTANT: Image 2 shows your column is "calendar_id", not "user_email"
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planName,
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active",
        })
        .eq("calendar_id", email); // Adjusted based on your Image 2

      if (error) throw error;
    }

    // 3. You MUST return a 200 OK for PayU to show "Success"
    return new NextResponse("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook Error:", err);
    return new NextResponse("Error", { status: 500 });
  }
}

export const dynamic = 'force-dynamic';