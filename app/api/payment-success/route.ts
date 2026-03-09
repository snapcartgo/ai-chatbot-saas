import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {

  const { searchParams } = new URL(req.url);

  const email = searchParams.get("email");
  const plan = searchParams.get("plan");

  if (!email || !plan) {
    return NextResponse.json({ error: "Missing email or plan" });
  }

  let message_limit = 100;

  if (plan === "starter") message_limit = 1000;
  if (plan === "pro") message_limit = 5000;
  if (plan === "growth") message_limit = 20000;

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  await supabase
    .from("subscriptions")
    .update({
      plan: plan,
      message_limit: message_limit,
      plan_expiry: expiry.toISOString(),
      status: "active"
    })
    .eq("user_email", email);

  return NextResponse.redirect("http://localhost:3000/dashboard");
}