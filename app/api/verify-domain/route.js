import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);

  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // check if bot already has a domain
  const { data: existing } = await supabase
    .from("domains")
    .select("*")
    .eq("user_id", botId)
    .maybeSingle();

  // first domain
  if (!existing) {

    await supabase
      .from("domains")
      .insert({
        domain: domain,
        user_id: botId
      });

    return Response.json({ allowed: true }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });

  }

  // same domain
  if (existing.domain === domain) {
    return Response.json({ allowed: true }, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  // different domain → block
  return Response.json({ allowed: false }, {
    headers: { "Access-Control-Allow-Origin": "*" }
  });

}