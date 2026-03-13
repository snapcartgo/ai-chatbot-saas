import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);

  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get bot owner
  const { data: bot } = await supabase
    .from("chatbots")
    .select("user_id")
    .eq("id", botId)
    .single();

  if (!bot) {
    return new Response(JSON.stringify({ allowed: false }));
  }

  // Check if domain already exists for this user
  const { data: domains } = await supabase
    .from("domains")
    .select("*")
    .eq("user_id", bot.user_id);

  // FIRST WEBSITE → SAVE AUTOMATICALLY
  if (!domains || domains.length === 0) {

    await supabase.from("domains").insert({
      domain: domain,
      user_id: bot.user_id
    });

    return new Response(JSON.stringify({ allowed: true }), {
      headers: { "Content-Type": "application/json" }
    });

  }

  // Check if this domain already allowed
  const match = domains.find(d => d.domain === domain);

  if (match) {
    return new Response(JSON.stringify({ allowed: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Different domain → BLOCK
  return new Response(JSON.stringify({ allowed: false }), {
    headers: { "Content-Type": "application/json" }
  });

}