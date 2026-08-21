export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { fulfillSaasBilling } from "@/lib/payment-fulfillment";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "PayU SaaS Billing Webhook is ready",
  });
}

export async function POST(req: Request) {
  try {
    let data: Record<string, any> = {};
    const contentType = req.headers.get("content-type") || "";

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } else {
      const rawText = await req.text();
      try {
        data = JSON.parse(rawText || "{}");
      } catch {
        data = {};
      }
    }

    const status = String(data.status || "").toLowerCase();
    const email = String(data.email || data.udf1 || "").toLowerCase().trim();
    const txnid = String(data.txnid || "");
    const amount = Number(data.amount || 0);
    const productinfo = String(data.productinfo || "");
    const firstname = String(data.firstname || "");
    const hash = String(data.hash || "");
    const key = String(data.key || process.env.PAYU_KEY || "");
    const salt = process.env.PAYU_SALT;

    // Check payment status
    if (status !== "success") {
      return NextResponse.json({ success: false, message: "Payment not successful" });
    }

    // Verify reverse hash if salt is present
    if (salt && hash) {
      const udf1 = data.udf1 || "";
      const udf2 = data.udf2 || "";
      const udf3 = data.udf3 || "";
      const udf4 = data.udf4 || "";
      const udf5 = data.udf5 || "";

      const hashSequence = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${data.amount || amount}|${txnid}|${key}`;

      const calculatedHash = crypto
        .createHash("sha512")
        .update(hashSequence)
        .digest("hex")
        .toLowerCase();

      if (calculatedHash !== hash.toLowerCase()) {
        return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
      }
    }

    if (!email) {
      return NextResponse.json({ error: "Email missing" }, { status: 400 });
    }

    // Combine identifier tags
    const rawPlan = [productinfo, data.udf1, data.udf2, data.udf3, data.udf4, data.udf5, txnid]
      .filter(Boolean)
      .join(" ");

    // Fulfill SaaS subscription
    const result = await fulfillSaasBilling({
      email,
      rawPlan: rawPlan || "Starter",
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}