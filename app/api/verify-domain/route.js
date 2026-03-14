import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);

  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  if (!botId || !domain) {
    return new Response(
      JSON.stringify({ allowed: false }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // Get existing domain for this bot
  const { data: domains, error } = await supabase
    .from("domains")
    .select("*")
    .eq("bot_id", botId);

  if (error) {
    console.error("Domain query error:", error);
    return new Response(
      JSON.stringify({ allowed: false }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // FIRST INSTALL → save domain
  if (!domains || domains.length === 0) {

    const { error: insertError } = await supabase
      .from("domains")
      .insert({
        bot_id: botId,
        domain: domain
      });

    if (insertError) {
      console.error("Insert domain error:", insertError);
    }

    return new Response(
      JSON.stringify({ allowed: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  // SAME DOMAIN → allow
  const match = domains.find(d => d.domain === domain);

  if (match) {
    return new Response(
      JSON.stringify({ allowed: true }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  // DIFFERENT DOMAIN → block
  return new Response(
    JSON.stringify({ allowed: false }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );

}