import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Helper function to resolve current authenticated user safely from cookies
async function getAuthenticatedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe fallback for Next.js Route Handlers
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { user, supabase };
}

// 1. GET: Fetch settings AND BYOK status for the logged-in customer
export async function GET() {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's saved API key & settings
    const { data: apiKeyData, error } = await supabase
      .from("user_api_keys")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check if user is on a BYOK plan in Website subscriptions
    const { data: webSub } = await supabase
      .from("subscriptions")
      .select("is_byok")
      .eq("email", user.email)
      .eq("is_byok", true);

    // Check if user is on a BYOK plan in WhatsApp subscriptions
    const { data: waSub } = await supabase
      .from("whatsapp_subscriptions")
      .select("is_byok")
      .eq("email", user.email)
      .eq("is_byok", true);

    const isByok = Boolean(
      (webSub && webSub.length > 0) || (waSub && waSub.length > 0)
    );

    return NextResponse.json({
      data: {
        bot_name: apiKeyData?.bot_name || "Woodpetra AI",
        openai_api_key: apiKeyData?.openai_api_key || "",
        openai_org_id: apiKeyData?.openai_org_id || "",
        openai_model: apiKeyData?.openai_model || "gpt-4o-mini",
        enable_chatbot: apiKeyData?.enable_chatbot ?? true,
        use_history_context: apiKeyData?.use_history_context ?? true,
        is_byok: isByok,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Save/Update settings with BYOK validation
export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      bot_name,
      openai_model,
      enable_chatbot,
      use_history_context,
      openai_api_key,
      openai_org_id,
    } = body;

    // Check BYOK requirement before saving
    const { data: webSub } = await supabase
      .from("subscriptions")
      .select("is_byok")
      .eq("email", user.email)
      .eq("is_byok", true);

    const { data: waSub } = await supabase
      .from("whatsapp_subscriptions")
      .select("is_byok")
      .eq("email", user.email)
      .eq("is_byok", true);

    const isByok = Boolean(
      (webSub && webSub.length > 0) || (waSub && waSub.length > 0)
    );

    if (isByok && (!openai_api_key || !openai_api_key.trim())) {
      return NextResponse.json(
        { error: "OpenAI API Key is compulsory for active BYOK subscriptions." },
        { status: 400 }
      );
    }

    // Build payload linked to authenticated user.id
    const payload: Record<string, any> = {
      user_id: user.id,
      bot_name: bot_name || "Woodpetra AI",
      openai_model: openai_model || "gpt-4o-mini",
      enable_chatbot: enable_chatbot ?? true,
      use_history_context: use_history_context ?? true,
      openai_api_key: openai_api_key ? openai_api_key.trim() : "",
      openai_org_id: openai_org_id ? openai_org_id.trim() : "",
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("user_api_keys")
      .upsert(payload, { onConflict: "user_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}