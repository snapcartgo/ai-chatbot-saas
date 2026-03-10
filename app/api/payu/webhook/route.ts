import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase with Service Role Key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// MUST BE "POST" - PayU sends POST requests
export async function POST(req: Request) {
  try {
    // 1. Parse PayU Form Data
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // 2. Extract relevant info (PayU uses these keys by default)
    const email = data.email as string;
    const status = data.status as string; 
    const planName = (data.productinfo as string || "starter").toLowerCase();

    // 3. Only update DB if payment is 'success'
    if (status === 'success') {
      
      // Type-safe limits object (Fixes your TS error)
      const limits: Record<string, { messages: number; chatbots: number }> = {
        starter: { messages: 1000, chatbots: 1 },
        pro: { messages: 5000, chatbots: 5 },
        growth: { messages: 20000, chatbots: 20 },
      };

      const selected = limits[planName] || limits["starter"];

      // 4. Update Supabase
      // NOTE: Verify if your column is "user_email" or "calendar_id"
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planName,
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active",
          plan_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_email", email); 

      if (error) {
        console.error("Supabase Error:", error.message);
        return new NextResponse("Database Update Failed", { status: 500 });
      }
    }

    // 5. PayU needs a 200 OK response to stop retrying
    return new NextResponse("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook Error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Crucial: Prevents Next.js from trying to cache this route
export const dynamic = 'force-dynamic';