import { NextResponse } from "next/server";
import {
  fulfillSaasBilling,
  isWhatsAppPlan,
  normalizePlan,
} from "@/lib/payment-fulfillment";

const saasUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://ai-chatbot-saas-five.vercel.app";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const email = (searchParams.get("email") || "").toLowerCase().trim();
    const rawPlan = searchParams.get("plan") || "";
    const amountParam = Number(searchParams.get("amount") || 0);

    if (!email) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=missing_email`);
    }

    if (!isWhatsAppPlan(rawPlan) && !normalizePlan(rawPlan)) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=invalid_plan`);
    }

    await fulfillSaasBilling({
      email,
      rawPlan,
      amount: Number.isFinite(amountParam) && amountParam > 0 ? amountParam : null,
    });

    return NextResponse.redirect(
      isWhatsAppPlan(rawPlan)
        ? `${saasUrl}/dashboard?payment=success&type=whatsapp`
        : `${saasUrl}/dashboard?payment=success&type=plan`
    );
  } catch (error) {
    console.error("payment-success GET error:", error);
    return NextResponse.redirect(`${saasUrl}/dashboard?error=server`);
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const status = String(formData.get("status") || "").toLowerCase();
    const email = String(formData.get("email") || "").toLowerCase().trim();
    const rawPlan = String(
      formData.get("udf2") || formData.get("productinfo") || ""
    );
    const amountParam = Number(formData.get("amount") || 0);

    if (status !== "success") {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=failed`);
    }

    if (!email) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=missing_email`);
    }

    if (!isWhatsAppPlan(rawPlan) && !normalizePlan(rawPlan)) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=invalid_plan`);
    }

    await fulfillSaasBilling({
      email,
      rawPlan,
      amount: Number.isFinite(amountParam) && amountParam > 0 ? amountParam : null,
    });

    return NextResponse.redirect(
      isWhatsAppPlan(rawPlan)
        ? `${saasUrl}/dashboard?payment=success&type=whatsapp`
        : `${saasUrl}/dashboard?payment=success&type=plan`
    );
  } catch (error) {
    console.error("payment-success POST error:", error);
    return NextResponse.redirect(`${saasUrl}/dashboard?error=server`);
  }
}