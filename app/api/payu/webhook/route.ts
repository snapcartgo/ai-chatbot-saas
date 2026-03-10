import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {

  const formData = await req.formData();
  const data = Object.fromEntries(formData);

  console.log("PayU webhook received:", data);

  const status = data.status;
  const userId = data.udf1;
  const plan = data.udf2;

  if (status === "success") {

    await supabase
      .from("subscriptions")
      .update({
        plan: plan,
        status: "active"
      })
      .eq("user_id", userId);

  }

  return NextResponse.json({ success: true });
}