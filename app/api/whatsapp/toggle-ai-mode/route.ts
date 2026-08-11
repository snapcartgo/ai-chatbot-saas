import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service Role Client (Bypasses Row Level Security)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export async function POST(req: Request) {
  try {
    const { phone, mode } = await req.json();

    if (!phone || !mode) {
      return NextResponse.json(
        { error: "Missing phone or mode parameters." },
        { status: 400 }
      );
    }

    const cleanPhone = normalizePhone(phone);

    // Update ALL matching conversation records in Supabase
    const { data, error } = await supabase
      .from("conversations")
      .update({ ai_mode: mode })
      .or(`phone_number.eq.${cleanPhone},phone_number.eq.+${cleanPhone},phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .select();

    if (error) {
      console.error("Database update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updatedCount: data?.length || 0,
      mode,
    });
  } catch (err: any) {
    console.error("Toggle AI Mode Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}