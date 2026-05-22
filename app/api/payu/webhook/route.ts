import { NextResponse } from "next/server";
import { fulfillSaasBilling } from "@/lib/payment-fulfillment";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const status = String(data.status || "").toLowerCase();
    const email = String(data.email || data.udf1 || "").toLowerCase().trim();
    const productinfo = String(data.productinfo || data.udf2 || "");
    const amount = Number(data.amount || 0);

    if (status !== "success") {
      return NextResponse.json({
        success: false,
        message: "Payment not successful",
      });
    }

    await fulfillSaasBilling({
      email,
      rawPlan: productinfo,
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    });

    return NextResponse.json({
      success: true,
      message: "SaaS billing webhook processed",
    });
  } catch (err) {
    console.error("payu webhook error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}