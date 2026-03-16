import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {

    const {
      message,
      conversation_id,
      bot_id,
      user_id,
      category,
      product_name,
      price,
      email
    } = await req.json();

    if (!message || !bot_id) {
      return NextResponse.json(
        { reply: "Missing required fields." },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { reply: "Webhook URL not configured." },
        { status: 500 }
      );
    }

    // Send message to n8n
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        conversation_id,
        bot_id,
        user_id,
        category
      }),
    });

    const data = await webhookResponse.json();

    let paymentLink = data.payment_link || null;

    // If n8n sends payment link → create pending order
    if (paymentLink && product_name && price) {

      const cleanLink = paymentLink.replace(/[.]+$/, "");

      const { error } = await supabase
        .from("orders")
        .insert({
          user_id: user_id,
          bot_id: bot_id,
          product_name: product_name,
          price: price,
          payment_status: "pending",
          customer_email: email
        });

      if (error) {
        console.error("Order insert error:", error);
      }

      paymentLink = cleanLink;
    }

    return NextResponse.json(
      {
        reply: data.reply,
        payment_link: paymentLink
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      }
    );

  } catch (error) {

    console.error("Webhook error:", error);

    return NextResponse.json(
      { reply: "Webhook failed." },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
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