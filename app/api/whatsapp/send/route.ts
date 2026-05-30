import { NextResponse } from "next/server";
import axios from "axios";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Extract and force it strictly to a positive BigInt number
    const raw_id = String(body.phone_number_id || "").trim();
    const clean_digits = raw_id.replace(/[^0-9]/g, "");

    if (!clean_digits) {
      return NextResponse.json(
        { error: "Invalid or missing phone_number_id" },
        { status: 400 }
      );
    }

    // Convert to BigInt to guarantee it is purely a number object structurally, then back to a string
    const validatedIdString = BigInt(clean_digits).toString();
    
    // Dynamic recipient resolution matching your client-side incoming keys
    const recipient_number = String(body.recipient_number || body.to || "").trim();

    if (!recipient_number) {
      return NextResponse.json(
        { error: "Missing recipient_number" },
        { status: 400 }
      );
    }

    // Extract optional template customization details from payload or fallback to testing values
    const templateName = String(body.template?.name || "onboarding_welcome_v1").trim();
    const languageCode = String(body.template?.language?.code || "en_US").trim();

    // 2. Clear SSRF tracing by building a strict fixed target URL object
    const baseTarget = new URL("https://graph.facebook.com");
    baseTarget.pathname = `/v23.0/${validatedIdString}/messages`;

    // 3. Fire the request using the strictly verified URL string
    const response = await axios.post(
      baseTarget.toString(),
      {
        messaging_product: "whatsapp",
        to: recipient_number, // Ensure this contains country code without '+' symbols (e.g., 91952...)
        type: "template",
        template: {
          name: templateName, 
          language: { 
            code: languageCode 
          }
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
    console.error("SSRF MITIGATED ROUTE ERROR:", err.response?.data || err.message);
    return NextResponse.json(
      { error: "Failed to send message", details: err.response?.data || err.message },
      { status: 500 }
    );
  }
}