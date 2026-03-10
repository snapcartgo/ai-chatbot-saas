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

  const status = data.status as string;
  const email = data.email as string;

  if (status === "success" && email) {

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: "pro",   // change plan here
        status: "active"
      })
      .eq("email", email);

    if (error) {
      console.log("Supabase update error:", error);
    } else {
      console.log("Plan updated for:", email);
    }

  }

  return NextResponse.json({ success: true });
}