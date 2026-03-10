import { NextResponse } from "next/server";

async function handle(req: Request) {
  try {
    let data: any = {};

    const contentType = req.headers.get("content-type");

    if (contentType && contentType.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      data = Object.fromEntries(form);
    } else if (contentType && contentType.includes("application/json")) {
      data = await req.json();
    } else {
      const { searchParams } = new URL(req.url);
      data = Object.fromEntries(searchParams);
    }

    console.log("PAYU WEBHOOK DATA:", data);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ success: false });
  }
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}