export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { fulfillSaasBilling } from "@/lib/payment-fulfillment";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Razorpay webhook is live and ready for POST requests",
  });
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (signature && secret) {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(bodyText)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("❌ Razorpay signature verification failed.");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const body = JSON.parse(bodyText);

    const supportedEvents = [
      "payment.captured",
      "payment_link.paid",
      "order.paid",
      "payment_page.paid",
      "invoice.paid",
    ];

    if (body.event && !supportedEvents.includes(body.event)) {
      return NextResponse.json({ received: true });
    }

    const payment = body.payload?.payment?.entity;
    const paymentLink = body.payload?.payment_link?.entity;
    const paymentPage = body.payload?.payment_page?.entity;
    const order = body.payload?.order?.entity;

    const paymentEmail = (
      payment?.email ||
      paymentLink?.customer?.email ||
      paymentPage?.customer?.email ||
      payment?.notes?.email ||
      order?.notes?.email ||
      ""
    )
      .toLowerCase()
      .trim();

    if (!paymentEmail) {
      console.error("❌ Webhook error: No customer email found in payload.");
      return NextResponse.json(
        { error: "No email payload found" },
        { status: 400 }
      );
    }

    const amount = payment?.amount
      ? Number(payment.amount) / 100
      : paymentLink?.amount
      ? Number(paymentLink.amount) / 100
      : null;

    const allNotesText = JSON.stringify({
      paymentNotes: payment?.notes,
      linkNotes: paymentLink?.notes,
      orderNotes: order?.notes,
      description: payment?.description,
      pageTitle: paymentPage?.title,
      pageId: paymentPage?.id,
      linkTitle: paymentLink?.title,
      linkId: paymentLink?.id,
    });

    const rawPlan = [
      paymentPage?.title,
      paymentPage?.id,
      paymentLink?.title,
      paymentLink?.id,
      paymentLink?.notes?.plan_id,
      paymentLink?.reference_id,
      payment?.notes?.plan_id,
      payment?.notes?.plan,
      payment?.notes?.title,
      payment?.notes?.payment_page_id,
      order?.notes?.plan_id,
      payment?.description,
      allNotesText,
    ]
      .filter(Boolean)
      .join(" ");

    console.log(
      `🔍 Webhook Processing | Event: ${body.event || "manual_test"} | User: ${paymentEmail} | Raw Identifier: "${rawPlan}"`
    );

    const result = await fulfillSaasBilling({
      email: paymentEmail,
      rawPlan: rawPlan || "WhatsApp Starter BYOK",
      amount,
    });

    console.log("🚀 Supabase tables updated successfully:", result);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("❌ Razorpay webhook handler error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}