import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

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

    // 1. Structural Validation Checks
    if (!client_id) {
      return NextResponse.json({ error: "Missing client_id" }, { status: 400 });
    }

    if (!waba_id || !phone_number_id) {
      return NextResponse.json({ error: "Missing waba_id or phone_number_id" }, { status: 400 });
    }

    // 2. CodeQL SSRF Security Fix: Enforce strictly numeric IDs before injection
    const isPureNumeric = /^\d+$/.test(phone_number_id);
    if (!isPureNumeric) {
      return NextResponse.json({ error: "Invalid phone_number_id format" }, { status: 400 });
    }

    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!whatsappToken) {
      return NextResponse.json(
        { error: "Server configuration error: Missing WhatsApp Access Token" }, 
        { status: 500 }
      );
    }

    // 3. Update Database Configurations
    const { error: dbError } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          user_id: client_id,
          waba_id: waba_id,
          business_id: business_id || waba_id,
          wa_phone_number: phone_number_id,
          status: "active",
          automation_enabled: true,
          workflow_type: "whatsapp_only",
        } as any,
        {
          onConflict: "user_id",
        }
      );

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    // 4. Secure Phone Number Registration with Meta
    try {
      const sanitizedPhoneId = encodeURIComponent(phone_number_id);
      const targetUrl = `https://graph.facebook.com/v23.0/${sanitizedPhoneId}/register`;
      
      await axios.post(
        targetUrl,
        {
          messaging_product: "whatsapp",
          pin: "123456",
        },
        {
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (registerError: any) {
      const errorData = registerError?.response?.data || registerError.message;
      console.error("REGISTER ERROR:", errorData);
      
      // Stop the routine and alert the frontend if onboarding failed downstream
      return NextResponse.json(
        { error: "Database updated, but failed to register number with Meta.", details: errorData },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    console.error("ONBOARD ERROR:", err);

    return NextResponse.json(
      {
        error: err.message || "Invalid request body",
      },
      {
        status: 400,
      }
    );
  }
}