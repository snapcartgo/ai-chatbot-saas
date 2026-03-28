import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const txnid = formData.get("txnid"); // 🔥 THIS IS ORDER ID

    console.log("PAYU RESPONSE:", Object.fromEntries(formData));

    // ✅ redirect to UI page
    return NextResponse.redirect(
      `https://ai-chatbot-saas-five.vercel.app/order-success?order_id=${txnid}`
    );

  } catch (error) {
    console.error("Error in PayU success:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}