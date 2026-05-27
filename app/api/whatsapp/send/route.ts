import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Extract the parameters sent from Thunder Client
    const phone_number_id = String(body.phone_number_id || "").trim();
    const recipient_number = String(body.recipient_number || "").trim();

    // 2. Validate that required fields are present
    if (!phone_number_id || !recipient_number) {
      return NextResponse.json(
        {
          error: "Missing required fields: phone_number_id or recipient_number",
        },
        { status: 400 }
      );
    }

    console.log(`Attempting to send template 'hello_test' to ${recipient_number} via Phone ID ${phone_number_id}...`);

    // 3. Make the request to Meta Graph API
    // Note: The locale code 'en_US' matches English templates on Meta Business Suite dashboards
    const response = await axios.post(
      `https://graph.facebook.com/v23.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to: recipient_number,
        type: "template",
        template: {
          name: "hello_test", 
          language: {
            code: "en_US", 
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    // 4. Return successful API response details
    return NextResponse.json({
      success: true,
      meta_response: response.data,
    });

  } catch (err: any) {
    // Captures structural, network, or Meta account rejection issues clearly in your terminal
    console.error(
      "META API REJECTION DETAILED LOG:",
      err.response?.data || err.message
    );

    return NextResponse.json(
      {
        error: "Failed to send message via Meta API",
        details: err.response?.data || err.message,
      },
      { status: err.response?.status || 500 }
    );
  }
}