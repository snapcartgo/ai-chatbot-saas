import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  try {

    const formData = await req.formData();
    const data = Object.fromEntries(formData);

    console.log("PayU webhook received:", data);

    const status = data.status as string;
    const userId = data.udf1 as string;
    const plan = data.udf2 as string;

    if (status === "success" && userId) {

      const { data: updateData, error } = await supabase
        .from("subscriptions")
        .update({
          plan: plan,
          status: "active"
        })
        .eq("user_id", userId)
        .select();

      console.log("Supabase update result:", updateData, error);
    }

    return NextResponse.json({ success: true });

  } catch (error) {

    console.error("Webhook error:", error);

    return NextResponse.json({ success: false });

  }
}