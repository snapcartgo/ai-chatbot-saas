import { NextResponse } from "next/server"

export async function POST(req: Request) {

  try {

    const formData = await req.formData()

    const status = formData.get("status")
    const txnid = formData.get("txnid")
    const amount = formData.get("amount")

    console.log("PayU webhook received:", {
      status,
      txnid,
      amount
    })

    return NextResponse.json({
      success: true
    })

  } catch (error) {

    console.error("Webhook error:", error)

    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    )
  }
}