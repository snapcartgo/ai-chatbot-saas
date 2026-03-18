import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    console.log("PayU webhook received:", data);

    const status = String(data.status || "");
    const email = String(data.email || "");
    const productinfo = String(data.productinfo || "").toLowerCase();
    const txnid = String(data.txnid || ""); // This is the Order ID from your DB

    if (status !== "success") {
      return NextResponse.json({ success: false, message: "Payment not successful" });
    }

    // --- CASE 1: E-COMMERCE ORDER UPDATE ---
    // If the productinfo DOES NOT contain your SaaS plan names, it's likely a client product
    const isSaasPlan = ["starter", "pro", "growth"].some(plan => productinfo.includes(plan));

    if (!isSaasPlan && txnid) {
      console.log("Processing E-commerce Order:", txnid);
      const { error: orderError } = await supabase
        .from("orders")
        .update({ 
          payment_status: "success",
          payment_id: data.mihpayid // Store PayU's transaction ID
        })
        .eq("id", txnid);

      if (orderError) console.error("Order Update Error:", orderError);
      return NextResponse.json({ success: true, type: "ecommerce" });
    }

    // --- CASE 2: SAAS SUBSCRIPTION UPDATE ---
    if (isSaasPlan && email) {
      console.log("Processing SaaS Subscription for:", email);
      
      let plan = "free";
      if (productinfo.includes("starter")) plan = "starter";
      if (productinfo.includes("pro")) plan = "pro";
      if (productinfo.includes("growth")) plan = "growth";

      let chatbotLimit = 1;
      let messageLimit = 100;
      let expiryDays = 30;

      if (plan === "pro") { chatbotLimit = 5; messageLimit = 5000; }
      if (plan === "growth") { chatbotLimit = 20; messageLimit = 20000; }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      const { error: subError } = await supabase
        .from("subscriptions")
        .update({
          plan: plan,
          status: "active",
          chatbot_limit: chatbotLimit,
          message_limit: messageLimit,
          plan_expiry: expiryDate.toISOString(),
          message_used: 0
        })
        .eq("email", email);

      if (subError) console.error("Subscription Update Error:", subError);
      return NextResponse.json({ success: true, type: "subscription" });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Webhook Global Error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}