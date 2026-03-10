import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    console.log("PayU Webhook Received Payload:", data);

    const status = data.status as string;
    
    // FIX 1: If udf1 is empty, use the standard 'email' field from PayU
    const email = (data.udf1 || data.email) as string; 
    
    // FIX 2: If udf2 is empty, check the 'productinfo' text for the plan name
    const productInfo = (data.productinfo as string || "").toLowerCase();
    let planName = "starter"; // Default fallback

    if (productInfo.includes("pro")) {
      planName = "pro";
    } else if (productInfo.includes("growth")) {
      planName = "growth";
    } else if (productInfo.includes("starter")) {
      planName = "starter";
    }

    if (status === "success" && email) {
      // Define limits based on the plan
      const limits: Record<string, { messages: number; chatbots: number }> = {
        starter: { messages: 1000, chatbots: 1 },
        pro: { messages: 5000, chatbots: 5 },
        growth: { messages: 20000, chatbots: 20 },
      };

      const selected = limits[planName];

      console.log(`Updating Supabase: Email: ${email}, Plan: ${planName}`);

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planName,            // Dynamically set based on the logic above
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("calendar_id", email);   // Uses 'calendar_id' as seen in your DB image

      if (error) {
        console.error("Supabase Update Error:", error.message);
        return new Response("Database Update Failed", { status: 500 });
      }

      console.log(`SUCCESS: Plan [${planName}] updated for ${email}`);
    }

    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook Processing Error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}