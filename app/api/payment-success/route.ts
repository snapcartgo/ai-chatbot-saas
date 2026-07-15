import { NextResponse } from "next/server";
import {
  fulfillSaasBilling,
  isWhatsAppPlan,
  normalizePlan,
} from "@/lib/payment-fulfillment";

const saasUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ai-chatbot-saas-five.vercel.app";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || "").toLowerCase().trim();
    const rawPlan = searchParams.get("plan") || "";
    const amountParam = Number(searchParams.get("amount") || 0);

    console.log("PAYMENT SUCCESS GET HIT:", { email, rawPlan, amountParam });

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

    // UPDATE THIS ONE HERE 👇
    return NextResponse.redirect(
      isWhatsAppPlan(rawPlan)
        ? `${saasUrl}/dashboard?payment=success&type=whatsapp`
        : `${saasUrl}/dashboard?payment=success&type=plan`,
      { status: 303 } 
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
    const email = String(formData.get("email") || formData.get("udf1") || "").toLowerCase().trim();
    
    // Fallback collection across common gateway fields
    const rawPlan = String(
      formData.get("udf2") || 
      formData.get("productinfo") || 
      formData.get("field2") || 
      ""
    ).trim();

    const amountParam = Number(formData.get("amount") || 0);

    console.log("PAYMENT SUCCESS POST HIT. PARSED VALUES:", {
      status,
      email,
      rawPlan,
      amountParam,
    });

    if (status !== "success" && status !== "completed") {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=failed`);
    }

    if (!email) {
      return NextResponse.redirect(`${saasUrl}/dashboard?error=missing_email`);
    }

    // Direct fallback check if gateway values wrap things inside general phrases like "WhatsApp Plan Payment"
    const isWhatsApp = isWhatsAppPlan(rawPlan);
    const validatedPlan = normalizePlan(rawPlan);

    if (!isWhatsApp && !validatedPlan) {
      console.error(`Rejected Fulfillment due to Unrecognized Plan String: "${rawPlan}"`);
      return NextResponse.redirect(`${saasUrl}/dashboard?error=invalid_plan`);
    }

    await fulfillSaasBilling({
      email,
      rawPlan,
      amount: Number.isFinite(amountParam) && amountParam > 0 ? amountParam : null,
    });

    // AND UPDATE THIS ONE HERE 👇
    return NextResponse.redirect(
      isWhatsAppPlan(rawPlan)
        ? `${saasUrl}/dashboard?payment=success&type=whatsapp`
        : `${saasUrl}/dashboard?payment=success&type=plan`,
      { status: 303 } 
    );
  } catch (error) {
    console.error("payment-success POST error:", error);
    return NextResponse.redirect(`${saasUrl}/dashboard?error=server`);
  }
}