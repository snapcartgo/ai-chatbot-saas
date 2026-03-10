import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  const body = await req.formData()

  const status = body.get("status")
  const userId = body.get("udf1")
  const plan = body.get("udf2")

  if (status !== "success") {
    return NextResponse.redirect("https://ai-chatbot-saas-five.vercel.app/pricing")
  }

  await supabase
    .from("subscriptions")
    .update({
      plan: plan,
      message_limit: 2000,
      status: "active"
    })
    .eq("user_id", userId)

  return NextResponse.redirect("https://ai-chatbot-saas-five.vercel.app/dashboard")
}