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

  const status = data.status
  const email = data.email
  const productinfo = String(data.productinfo || "").toLowerCase()

  let plan = "starter"

  if (productinfo.includes("pro")) {
    plan = "pro"
  }

  if (productinfo.includes("growth")) {
    plan = "growth"
  }

  if (status === "success") {

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: plan,
        status: "active"
      })
      .eq("email", email)

    if (error) {
      console.log("Supabase error:", error)
    } else {
      console.log("Plan updated for:", email, "Plan:", plan)
    }
  }

  return NextResponse.json({ success: true })
}