import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Extract and Sanitize the ID
    // We use a Regex to ensure it ONLY contains digits.
    const raw_id = String(body.phone_number_id || "").trim();
    const phone_number_id = raw_id.replace(/[^0-9]/g, ""); // Removes everything except 0-9

    const recipient_number = String(body.recipient_number || "").trim();

    // 2. Validate input
    if (!phone_number_id || !recipient_number) {
      return NextResponse.json(
        { error: "Invalid or missing phone_number_id or recipient_number" },
        { status: 400 }
      );
    }

    // 3. Construct the URL securely
    // By using the cleaned 'phone_number_id', we prevent path traversal attacks.
    const metaUrl = `https://graph.facebook.com/v23.0/${phone_number_id}/messages`;

    const response = await axios.post(
      metaUrl,
      {
        messaging_product: "whatsapp",
        to: recipient_number,
        type: "template",
        template: {
          name: "hello_test", 
          language: { code: "en" }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json({ success: true, data: response.data });

  } catch (err: any) {
    console.error("SSRF FIXED SEND ERROR:", err.response?.data || err.message);
    return NextResponse.json(
      { error: "Failed to send message", details: err.response?.data },
      { status: 500 }
    );
  }
}