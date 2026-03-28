import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const status = formData.get("status"); // success / failure
    const txnid = formData.get("txnid"); // order id
    const payment_id = formData.get("mihpayid"); // 🔥 important

    console.log("PAYU RESPONSE:", Object.fromEntries(formData));

    // ✅ UPDATE DATABASE
    if (status === "success") {
      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          payment_id: payment_id,
        })
        .eq("id", txnid);
    }

    // 🔥 REDIRECT WITH 303
    const url = new URL(
      `/order-success?order_id=${txnid}`,
      "https://ai-chatbot-saas-five.vercel.app"
    );

    return NextResponse.redirect(url, { status: 303 });

  } catch (error) {
    console.error("Error in PayU success:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}