import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use SERVICE_ROLE to bypass RLS
);

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    console.log("PayU Webhook Received:", data);

    const status = data.status as string;
    // Safety check: Use 'email' if 'udf1' is empty
    const email = (data.udf1 || data.email) as string; 
    
    // Safety check: Parse plan from 'productinfo' if 'udf2' is empty
    const productInfo = (data.productinfo as string || "").toLowerCase();
    let planName = "starter";
    if (productInfo.includes("pro")) planName = "pro";
    if (productInfo.includes("growth")) planName = "growth";

    if (status === "success" && email) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: planName,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("calendar_id", email); // Ensure this matches your Supabase column name

      if (error) {
        console.error("Supabase Error:", error.message);
        return new Response(`DB Error: ${error.message}`, { status: 500 });
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    console.error("Webhook Crash:", err.message);
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}