import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  const formData = await req.formData()
  const data = Object.fromEntries(formData)

  console.log("PayU webhook received:", data)

  const status = String(data.status || "")
  const email = String(data.email || "")
  const productinfo = String(data.productinfo || "").toLowerCase()

  // Detect plan from PayU product info
  let plan = "free"

  if (productinfo.includes("starter")) plan = "starter"
  if (productinfo.includes("pro")) plan = "pro"
  if (productinfo.includes("growth")) plan = "growth"

  if (status === "success" && email) {

    let chatbotLimit = 1
    let messageLimit = 100
    let expiryDays = 30

    // Free plan
    if (plan === "free") {
      chatbotLimit = 1
      messageLimit = 100
    }

    // Starter plan
    if (plan === "starter") {
      chatbotLimit = 1
      messageLimit = 100
    }

    // Pro plan
    if (plan === "pro") {
      chatbotLimit = 5
      messageLimit = 5000
    }

    // Growth plan
    if (plan === "growth") {
      chatbotLimit = 20
      messageLimit = 20000
    }

    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + expiryDays)

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: plan,
        status: "active",
        chatbot_limit: chatbotLimit,
        message_limit: messageLimit,
        plan_expiry: expiryDate.toISOString(),
        message_used: 0
      })
      .eq("calendar_id", email)

    if (error) {
      console.log("Supabase error:", error)
    } else {
      console.log("Plan updated successfully:", plan)
    }
  }

  return NextResponse.json({ success: true })
}