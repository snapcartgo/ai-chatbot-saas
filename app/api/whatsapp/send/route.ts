// app/api/whatsapp/send/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { user_id, message, recipient_phone } = await req.json();

    // Ensure we have the user_id from the session/request
    if (!user_id || !message || !recipient_phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Lookup config based ONLY on User ID
    const { data: config, error } = await supabase
      .from("whatsapp_configs")
      .select("whatsapp_access_token, whatsapp_phone_id")
      .eq("user_id", user_id)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: "WhatsApp not configured for this user" }, { status: 404 });
    }

    // Push to Meta API
    const res = await fetch(`https://graph.facebook.com/v18.0/${config.whatsapp_phone_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient_phone,
        type: "text",
        text: { body: message },
      }),
    });

    const result = await res.json();
    return NextResponse.json({ success: res.ok, result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}