import { NextResponse } from "next/server"

export async function POST(req: Request) {

  try {

    const formData = await req.formData()

    console.log("PayU Webhook POST:", Object.fromEntries(formData))

    return NextResponse.json({
      received: true
    })

  } catch (error) {

    console.error("Webhook POST error:", error)

    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    )
  }
}

export async function GET() {

  return NextResponse.json({
    message: "Webhook working"
  })
}