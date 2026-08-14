import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    // 1. Fetch user record from Supabase
    const { data } = await supabase
      .from("user_api_keys")
      .select("openai_api_key, openai_model, enable_chatbot")
      .eq("user_id", user_id)
      .maybeSingle();

    // 2. Check if chatbot is explicitly disabled
    if (data && data.enable_chatbot === false) {
      return NextResponse.json(
        { error: "Chatbot is disabled by user" },
        { status: 403 }
      );
    }

    // 3. Fallback logic: Use customer key if available, else process.env.OPENAI_API_KEY
    const customerKey = data?.openai_api_key?.trim();
    const platformMasterKey = process.env.OPENAI_API_KEY;

    const activeApiKey = customerKey || platformMasterKey;

    // Safety check if OPENAI_API_KEY is missing from .env
    if (!activeApiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured in environment variables" },
        { status: 500 }
      );
    }

    // 4. Return active key configuration
    return NextResponse.json({
      active_api_key: activeApiKey,
      active_model: data?.openai_model || "gpt-4o-mini",
      is_byok: Boolean(customerKey),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}