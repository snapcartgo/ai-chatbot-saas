import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use Service Role Key to bypass RLS for backend updates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    console.log("PayU Webhook Received:", data);

    const status = data.status as string;
    
    // We use UDF1 for email and UDF2 for plan (as set in your PayU redirect route)
    const email = data.udf1 as string; 
    const planName = (data.udf2 as string || "starter").toLowerCase();

    if (status === "success" && email) {
      // Define limits based on the plan name received from PayU
      const limits: Record<string, { messages: number; chatbots: number }> = {
        starter: { messages: 1000, chatbots: 1 },
        pro: { messages: 5000, chatbots: 5 },
        growth: { messages: 20000, chatbots: 20 },
      };

      const selected = limits[planName] || limits["starter"];

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planName,            // Dynamically updates to starter, pro, or growth
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("calendar_id", email);   // Matches the column name seen in your Supabase screenshot

      if (error) {
        console.error("Supabase Update Error:", error.message);
        return new Response("Database Update Failed", { status: 500 });
      }

      console.log(`Plan [${planName}] successfully updated for: ${email}`);
    }

    // PayU expects a 200 OK response to stop retrying the webhook
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook Processing Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}