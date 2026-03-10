import { NextResponse } from "next/server";

export async function POST(req: Request) {

  const formData = await req.formData();
  const data = Object.fromEntries(formData);

  console.log("PayU webhook received:", data);

  return NextResponse.json({
    success: true
  });
}