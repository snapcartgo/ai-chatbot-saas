import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);

  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  console.log("BOT ID:", botId);
  console.log("DOMAIN:", domain);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: bot, error: botError } = await supabase
    .from("chatbots")
    .select("user_id")
    .eq("id", botId)
    .single();

  console.log("BOT RESULT:", bot);
  console.log("BOT ERROR:", botError);

  if (!bot) {
    return Response.json({ allowed:false },{
      headers:{ "Access-Control-Allow-Origin":"*" }
    });
  }

  const { data: existing } = await supabase
    .from("domains")
    .select("*")
    .eq("domain", domain)
    .eq("user_id", bot.user_id)
    .maybeSingle();

  console.log("EXISTING DOMAIN:", existing);

  if (!existing) {

    const { data, error } = await supabase
      .from("domains")
      .insert({
        domain: domain,
        user_id: bot.user_id
      });

    console.log("INSERT RESULT:", data);
    console.log("INSERT ERROR:", error);
  }

  return Response.json({ allowed:true },{
    headers:{ "Access-Control-Allow-Origin":"*" }
  });

}