import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {

    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    console.log("PayU Webhook Received:", data);

    const status = data.status as string;
    const email = data.email as string;
    const productinfo = ((data.productinfo as string) || "").toLowerCase();

    let planName: "starter" | "pro" | "growth" = "starter";

    if (productinfo.includes("pro")) planName = "pro";
    if (productinfo.includes("growth")) planName = "growth";

    const limits = {
      starter: { messages: 1000, chatbots: 1 },
      pro: { messages: 5000, chatbots: 5 },
      growth: { messages: 20000, chatbots: 20 },
    };

    const selected = limits[planName];

    if (status === "success" && email) {

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planName,
          message_limit: selected.messages,
          chatbot_limit: selected.chatbots,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        console.error("Supabase Update Error:", error);
      } else {
        console.log(`Plan updated to ${planName} for ${email}`);
      }
    }

  } catch (err) {
    console.error("Webhook Processing Error:", err);
  }

  return new Response("OK", { status: 200 });
}