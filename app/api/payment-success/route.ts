import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-chatbot-saas-five.vercel.app';
  
  try {
    const formData = await req.formData();
    const status = formData.get('status');
    const txnid = formData.get('txnid')?.toString() || "";
    const amount = Number(formData.get('amount') || 0);
    const email = (formData.get('email') || formData.get('udf1') || "").toString().toLowerCase().trim();
    
    // 🔥 This is the key: udf2 tells us if it's a Plan or a Product
    const purchaseItem = (formData.get('udf2') || "").toString().toLowerCase();

    console.log(`Payment for: ${email} | Item: ${purchaseItem} | Status: ${status}`);

    if (status !== "success") {
      return NextResponse.redirect(`${baseUrl}/dashboard?payment=failed`, { status: 303 });
    }

    // ---------------------------------------------------------
    // ✅ STEP 1: ALWAYS UPDATE THE ORDERS TABLE (For Record Keeping)
    // ---------------------------------------------------------
    await supabase
      .from("orders")
      .update({ payment_status: "paid", payment_id: txnid })
      .eq("customer_email", email)
      .eq("payment_status", "pending");

    // ---------------------------------------------------------
    // ✅ STEP 2: LOGIC SWITCH (Plan vs Product)
    // ---------------------------------------------------------
    
    // List of your SaaS plan names
    const saasPlans = ["growth", "pro", "enterprise", "basic"];

    if (saasPlans.includes(purchaseItem)) {
      // --- THIS IS SAAS PLAN LOGIC ---
      console.log("Processing SaaS Plan Upgrade...");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (profile) {
        // Update Subscription table
        await supabase
          .from("subscriptions")
          .update({ amount: amount, status: "active" })
          .match({ user_id: profile.id, plan: purchaseItem });

        // Update Referrals
        const commission = amount * 0.2;
        await supabase
          .from("referrals")
          .update({ amount, commission_amount: commission, payment_status: "paid", status: "completed" })
          .eq("referred_user_id", profile.id);
      }
      
      return NextResponse.redirect(`${baseUrl}/dashboard?payment=success&type=plan`, { status: 303 });

    } else {
      // --- THIS IS ECOMMERCE PRODUCT LOGIC ---
      console.log("Processing eCommerce Product Purchase...");
      
      // We already updated the 'orders' table in Step 1. 
      // You don't need to update subscriptions here.
      
      return NextResponse.redirect(`${baseUrl}/dashboard?payment=success&type=order`, { status: 303 });
    }

  } catch (err) {
    console.error("API Error:", err);
    return NextResponse.redirect(`${baseUrl}/dashboard?status=error`, { status: 303 });
  }
}