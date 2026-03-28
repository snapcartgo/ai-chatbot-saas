import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use Service Role to bypass RLS
);

const saasUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-chatbot-saas-five.vercel.app';

// --- HANDLE GET (Manual browser tests & PayPal redirects) ---
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  const plan = searchParams.get("plan")?.toLowerCase();

  if (!email || !plan) {
    return NextResponse.json({ error: "Missing email or plan" }, { status: 400 });
  }

  // Reuse logic to update Supabase
  await updateSubscriptionLogic(email, plan, 1, "MANUAL_TEST");

  return NextResponse.redirect(`${saasUrl}/dashboard/Billing?payment=success`, { status: 303 });
}

// --- HANDLE POST (PayU and Webhooks) ---
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const status = formData.get('status')?.toString();
    const txnid = formData.get('txnid')?.toString() || "WEBHOOK";
    const amount = Number(formData.get('amount') || 0);
    const email = (formData.get('email') || formData.get('udf1') || "").toString().toLowerCase().trim();
    const purchaseItem = (formData.get('udf2') || "starter").toString().toLowerCase();

    console.log(`Payment for: ${email} | Item: ${purchaseItem} | Status: ${status}`);

    if (status !== "success") {
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=failed`, { status: 303 });
    }

    // 1. Always update order records
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_id: txnid })
      .eq("customer_email", email)
      .eq("payment_status", "pending");

    // 2. Process Subscription if it matches SaaS plans
    const saasPlans = ["growth", "pro", "enterprise", "basic", "starter"];
    if (saasPlans.includes(purchaseItem)) {
      await updateSubscriptionLogic(email, purchaseItem, amount, txnid);
      return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=plan`, { status: 303 });
    }

    return NextResponse.redirect(`${saasUrl}/dashboard?payment=success&type=order`, { status: 303 });

  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.redirect(`${saasUrl}/dashboard?status=error`, { status: 303 });
  }
}

// --- SHARED DATABASE LOGIC ---
async function updateSubscriptionLogic(email: string, plan: string, amount: number, txnid: string) {
  // Get user ID from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (profile) {
    // Upsert ensures the plan is either updated or created if missing
    await supabase
      .from("subscriptions")
      .upsert({ 
        user_id: profile.id, 
        plan: plan, 
        status: "active",
        amount: amount 
      }, { onConflict: 'user_id' });

    // Handle Referral Commissions (20%)
    const commission = amount * 0.2;
    await supabase
      .from("referrals")
      .update({ 
        amount, 
        commission_amount: commission, 
        payment_status: "paid", 
        status: "completed" 
      })
      .eq("referred_user_id", profile.id);
  }
}