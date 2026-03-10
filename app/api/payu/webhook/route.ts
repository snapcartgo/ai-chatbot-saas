import { NextResponse } from "next/server";

async function handleRequest(req: Request) {
  try {
    let data: any = {};

    const contentType = req.headers.get("content-type");

    if (contentType && contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      data = Object.fromEntries(formData);
    } 
    else if (contentType && contentType.includes("application/json")) {
      data = await req.json();
    } 
    else {
      const { searchParams } = new URL(req.url);
      data = Object.fromEntries(searchParams);
    }

    console.log("PayU webhook received:", data);

    return NextResponse.json({
      success: true,
      message: "Webhook working",
      receivedData: data
    });

  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json({
      success: false,
      error: "Webhook failed"
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleRequest(req);
}

export async function GET(req: Request) {
  return handleRequest(req);
}