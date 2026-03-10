import { NextResponse } from "next/server";

export async function POST(req: Request) {

  const formData = await req.formData()
  const data = Object.fromEntries(formData)

  console.log("FULL PAYU DATA:", data)

  return new Response(JSON.stringify({ success: true }))
}