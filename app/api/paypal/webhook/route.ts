export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fulfillSaasBilling } from "@/lib/payment-fulfillment";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "PayPal SaaS Billing Webhook is active",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const supportedEvents = [
      "PAYMENT.CAPTURE.COMPLETED",
      "CHECKOUT.ORDER.APPROVED",
      "BILLING.SUBSCRIPTION.ACTIVATED",
    ];

    if (body.event_type && !supportedEvents.includes(body.event_type)) {
      return NextResponse.json({ received: true });
    }

    const resource = body.resource || {};

    let paymentEmail = (
      resource.payer?.email_address ||
      resource.subscriber?.email_address ||
      ""
    )
      .toLowerCase()
      .trim();

    let customData: any = {};
    const customString =
      resource.custom_id ||
      resource.custom ||
      resource.purchase_units?.[0]?.custom_id;

    if (customString) {
      try {
        customData = JSON.parse(customString);
        if (customData.email) paymentEmail = customData.email.toLowerCase().trim();
      } catch {
        customData = { plan: customString };
      }
    }

    if (!paymentEmail) {
      return NextResponse.json({ error: "Email missing" }, { status: 400 });
    }

    const rawPlan = [
      customData.plan,
      resource.plan_id,
      resource.description,
      resource.purchase_units?.[0]?.description,
      resource.purchase_units?.[0]?.items?.[0]?.name,
    ]
      .filter(Boolean)
      .join(" ");

    const amount = Number(
      resource.amount?.value ||
      resource.purchase_units?.[0]?.amount?.value ||
      customData.amount ||
      0
    );

    const result = await fulfillSaasBilling({
      email: paymentEmail,
      rawPlan: rawPlan || "Starter",
      amount: amount > 0 ? amount : null,
    });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("❌ PayPal webhook error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}