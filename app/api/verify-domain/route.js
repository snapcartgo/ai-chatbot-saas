import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);

  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get all domains for this bot
  const { data: domains } = await supabase
    .from("domains")
    .select("*")
    .eq("user_id", botId);

  // FIRST INSTALL
  if (!domains || domains.length === 0) {

    await supabase
      .from("domains")
      .insert({
        domain: domain,
        bot_id: botId
      });

    return Response.json({ allowed: true }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });

  }

  // SAME DOMAIN
  const match = domains.find(d => d.domain === domain);

  if (match) {
    return Response.json({ allowed: true }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  // DIFFERENT DOMAIN → BLOCK
  return Response.json({ allowed: false }, {
    headers: { "Access-Control-Allow-Origin": "*" }
  });

}