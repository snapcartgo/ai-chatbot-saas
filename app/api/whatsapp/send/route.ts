import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TWILIO_WHATSAPP_DEFAULT_FROM = "whatsapp:+14155238886";

function normalizeWhatsAppNumber(value: string | null | undefined) {
  if (!value) return "";
  if (value.startsWith("whatsapp:")) return value;
  if (value.startsWith("+")) return `whatsapp:${value}`;
  return `whatsapp:+${value}`;
}

export async function POST(req: Request) {
  try {
    const { user_id, message, recipient_phone } = await req.json();

    if (!user_id || !message || !recipient_phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: config, error } = await supabase
      .from("whatsapp_configs")
      .select("twilio_sid, twilio_auth_token, phone_number")
      .eq("user_id", user_id)
      .maybeSingle();

    if (error || !config) {
      return NextResponse.json({ error: "WhatsApp not configured for this user" }, { status: 404 });
    }

    if (!config.twilio_sid || !config.twilio_auth_token) {
      return NextResponse.json({ error: "Twilio credentials are incomplete" }, { status: 400 });
    }

    const to = normalizeWhatsAppNumber(recipient_phone);
    const from = normalizeWhatsAppNumber(config.phone_number) || TWILIO_WHATSAPP_DEFAULT_FROM;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilio_sid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${config.twilio_sid}:${config.twilio_auth_token}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Body: message,
        }),
      }
    );

    const result = await res.json();
    return NextResponse.json({ success: res.ok, result }, { status: res.ok ? 200 : res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
