import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {

    // PayU sends form-data
    const formData = await req.formData();
    const data = Object.fromEntries(formData);

    console.log("PayU webhook received:", data);

    const status = data.status as string;
    const userId = data.udf1 as string;
    const plan = data.udf2 as string;

    if (status === "success" && userId) {

      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: plan || "starter",
          status: "active"
        })
        .eq("user_id", userId);

      if (error) {
        console.error("Supabase update error:", error);
      } else {
        console.log("Subscription updated for user:", userId);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}