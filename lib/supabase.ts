import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  const formData = await req.formData()
  const data = Object.fromEntries(formData)

  const status = data.status
  const email = data.email
  const plan = data.udf2 || "starter"

  if (status === "success") {

    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: plan,
        status: "active"
      })
      .eq("email", email)

    if (error) {
      console.log("Supabase update error:", error)
    } else {
      console.log("Subscription updated for:", email)
    }
  }

  return new Response(JSON.stringify({ success: true }))
}