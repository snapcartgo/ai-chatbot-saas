import { NextResponse } from "next/server";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawId = String(body.phone_number_id || "").trim();
    const cleanDigits = rawId.replace(/[^0-9]/g, "");

    if (!cleanDigits) {
      return NextResponse.json(
        { error: "Invalid or missing phone_number_id" },
        { status: 400 }
      );
    }

    const validatedIdString = BigInt(cleanDigits).toString();
    const recipientNumber = String(
      body.recipient_number || body.to || ""
    ).trim();

    if (!recipientNumber) {
      return NextResponse.json(
        { error: "Missing recipient_number" },
        { status: 400 }
      );
    }

    const templateName = String(
      body.template?.name || "hello_test"
    ).trim();

    const languageCode = String(
      body.template?.language?.code || "en"
    ).trim();

    // Correct DB lookup column
    const { data: config, error: dbError } = await supabase
      .from("whatsapp_configs")
      .select("meta_access_token, wa_phone_number_id, status")
      .eq("wa_phone_number_id", validatedIdString)
      .maybeSingle();

    if (dbError) {
      console.error("Supabase lookup error:", dbError.message);
      return NextResponse.json(
        { error: dbError.message },
        { status: 500 }
      );
    }

    if (!config) {
      return NextResponse.json(
        {
          error: `Configuration not found in Supabase database for ID: ${validatedIdString}`,
        },
        { status: 404 }
      );
    }

    // IMPORTANT: use env token first because that is what was working earlier
    const activeToken =
      String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim() ||
      String(config.meta_access_token || "").trim();

    if (!activeToken) {
      return NextResponse.json(
        { error: "Missing WhatsApp access token" },
        { status: 401 }
      );
    }

    const baseTarget = new URL("https://graph.facebook.com");
    baseTarget.pathname = `/v24.0/${validatedIdString}/messages`;

    const response = await axios.post(
      baseTarget.toString(),
      {
        messaging_product: "whatsapp",
        to: recipientNumber,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (err: any) {
    console.error("WHATSAPP SEND ERROR:", err.response?.data || err.message);

    return NextResponse.json(
      {
        error: "Failed to send message",
        details: err.response?.data || err.message,
      },
      { status: 500 }
    );
  }
}