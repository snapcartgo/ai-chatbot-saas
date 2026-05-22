import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const client_id = String(body.client_id || "").trim();
    const waba_id = String(body.waba_id || "").trim();
    const phone_number_id = String(body.phone_number_id || "").trim();
    const business_id = String(body.business_id || "").trim();

    if (!client_id) {
      return NextResponse.json(
        { error: "Missing client_id" },
        { status: 400 }
      );
    }

    if (!waba_id || !phone_number_id) {
      return NextResponse.json(
        { error: "Missing waba_id or phone_number_id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          user_id: client_id,
          waba_id,
          wa_phone_number: phone_number_id,
          business_id: business_id || null,
          status: "active",
          automation_enabled: true,
          workflow_type: "whatsapp_only",
        } as any,
        { onConflict: "user_id" }
      );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Invalid request body" },
      { status: 400 }
    );
  }
}