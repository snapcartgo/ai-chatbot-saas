import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Mapping: We pull every possible name for these IDs
    const message = body.message;
    const bot_id = body.bot_id || body.chatbotId || body.activeBotId;
    const conversation_id = body.conversation_id || body.sessionId;
    const category = body.category || "general"; // Default to general if missing
    
    // Optional e-commerce/booking fields
    const { user_id, product_name, price, email } = body;

    // CRITICAL: If these are missing, n8n won't trigger correctly
    if (!message || !bot_id) {
      return NextResponse.json(
        { reply: "Error: Message or Bot ID is missing in the request." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    // Trigger n8n with the exact keys your workflow expects
    const webhookResponse = await fetch(webhookUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        bot_id,
        conversation_id,
        category
      }),
    });

    const data = await webhookResponse.json();

    // Logic for E-commerce / Booking
    let paymentLink = data.payment_link || null;
    if (paymentLink && product_name && price) {
      await supabase.from("orders").insert({
        user_id,
        bot_id,
        product_name,
        price,
        payment_status: "pending",
        customer_email: email
      });
    }

    return NextResponse.json(
      { reply: data.reply || data.output, payment_link: paymentLink },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ reply: "Connection error." }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}