import { NextResponse } from "next/server";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const recipientNumber = String(body.recipient_number || "").trim();
    const message = String(body.message || "").trim();
    const phoneNumberId = String(body.phone_number_id || "").trim();

    if (!recipientNumber || !message || !phoneNumberId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: config, error } = await supabase
      .from("whatsapp_configs")
      .select("meta_access_token")
      .eq("wa_phone_number_id", phoneNumberId)
      .single();

    if (error || !config) {
      return NextResponse.json(
        { error: "WhatsApp configuration not found" },
        { status: 404 }
      );
    }

    const token = config.meta_access_token;

    const response = await axios.post(
      `https://graph.facebook.com/v24.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: recipientNumber,
        type: "text",
        text: {
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data,
    });
  } catch (err: any) {
    console.error(err.response?.data || err);

    return NextResponse.json(
      {
        error: err.response?.data || err.message,
      },
      { status: 500 }
    );
  }
}