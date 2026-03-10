import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase with Service Role Key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. PayU sends data as Form Data
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    // Extract fields sent by PayU
    const email = data.email as string;
    const status = data.status as string;
    const planFromPayU = (data.productinfo as string || "starter").toLowerCase();

    if (status === 'success') {
      // 2. Define the limits with proper TypeScript typing
      const limits: Record<string, { messages: number; chatbots: number }> = {
        starter: { messages: 100, chatbots: 1 },
        pro: { messages: 5000, chatbots: 5 },
        growth: { messages: 20000, chatbots: 20 },
      };

      // 3. Get the selected plan or default to starter
      const selected = limits[planFromPayU] || limits["starter"];

      // 4. Update Supabase
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planFromPayU,
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active",
          // Adding expiry logic (optional but recommended)
          plan_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq("user_email", email);

      if (error) {
        console.error("Supabase Update Error:", error);
        return new NextResponse("Database Error", { status: 500 });
      }
    }

    // Always return 200 to PayU to acknowledge receipt
    return new NextResponse("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook Handler Error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Force dynamic execution to prevent build-time errors
export const dynamic = 'force-dynamic';