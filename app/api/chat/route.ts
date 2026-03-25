import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Destructure all possible fields from the frontend request
    const {
      message,
      conversation_id,
      bot_id,       // Field from your current API logic
      chatbotId,    // Field being sent by ChatWidget.tsx
      user_id,
      category,
      product_name,
      price,
      email
    } = body;

    // Use whichever bot ID is available
    const activeBotId = bot_id || chatbotId;

    // 1. Check for required fields - this fixes your 400 error
    if (!message || !activeBotId) {
      console.error("Validation failed. Received:", { message, activeBotId });
      return NextResponse.json(
        { reply: "Missing required fields (message or bot_id)." },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { reply: "Webhook URL not configured in environment variables." },
        { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    // 2. Send data to n8n
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id,
        bot_id: activeBotId,
        user_id,
        category
      }),
    });

    if (!webhookResponse.ok) {
        throw new Error(`n8n responded with status: ${webhookResponse.status}`);
    }

    const data = await webhookResponse.json();

    let paymentLink = data.payment_link || null;

    // 3. Create pending order if n8n returns payment info
    if (paymentLink && product_name && price) {
      const cleanLink = paymentLink.replace(/[.]+$/, "");
      
      const { error } = await supabase
        .from("orders")
        .insert({
          user_id: user_id || null,
          bot_id: activeBotId,
          product_name: product_name,
          price: price,
          payment_status: "pending",
          customer_email: email || null
        });

      if (error) console.error("Supabase Order Insert Error:", error);
      paymentLink = cleanLink;
    }

    // 4. Final Success Response with CORS headers
    return NextResponse.json(
      {
        reply: data.reply || data.output || "I'm not sure how to respond to that.",
        payment_link: paymentLink
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      }
    );

  } catch (error: any) {
    console.error("API Route Error:", error.message);
    return NextResponse.json(
      { reply: "The chat service is temporarily unavailable." },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
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