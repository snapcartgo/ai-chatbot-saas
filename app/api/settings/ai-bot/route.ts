import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_email, bot_name, openai_model, enable_chatbot, use_history_context, openai_api_key, openai_org_id } = body;

    if (!user_email) {
      return NextResponse.json({ error: "User email required" }, { status: 400 });
    }

    // 1. Fetch user ID from auth/users or existing database record
    const { data: userData, error: userError } = await supabase
      .from("user_api_keys")
      .select("user_id")
      .maybeSingle();

    // Or resolve user_id via Supabase Admin API
    const { data: usersList } = await supabase.auth.admin.listUsers();
    const currentUser = usersList?.users?.find((u) => u.email === user_email);

    if (!currentUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // 2. Prepare Payload
    const payload: Record<string, any> = {
      user_id: currentUser.id,
      bot_name: bot_name || "Woodpetra AI",
      openai_model: openai_model || "gpt-4o-mini",
      enable_chatbot: enable_chatbot ?? true,
      use_history_context: use_history_context ?? true,
      updated_at: new Date().toISOString(),
    };

    if (openai_api_key && openai_api_key !== "value exist add new to update") {
      payload.openai_api_key = openai_api_key;
    }
    if (openai_org_id && openai_org_id !== "value exist add new to update") {
      payload.openai_org_id = openai_org_id;
    }

    // 3. Upsert data into Supabase
    const { error: upsertError } = await supabase
      .from("user_api_keys")
      .upsert(payload, { onConflict: "user_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}