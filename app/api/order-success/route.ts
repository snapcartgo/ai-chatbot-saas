import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const txnid = formData.get("txnid");

  const url = new URL(
    `/order-success?order_id=${txnid}`,
    "https://ai-chatbot-saas-five.vercel.app"
  );

  // 🔥 IMPORTANT: force GET redirect
  return NextResponse.redirect(url, {
    status: 303, // 👈 THIS FIXES YOUR ISSUE
  });
}