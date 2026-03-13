import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);

  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // get chatbot owner
  const { data: bot } = await supabase
    .from("chatbots")
    .select("user_id")
    .eq("id", botId)
    .single();

  if (!bot) {
    return new Response(JSON.stringify({ allowed:false }),{
      headers:{
        "Content-Type":"application/json",
        "Access-Control-Allow-Origin":"*"
      }
    });
  }

  // check if domain exists
  const { data: existing } = await supabase
    .from("domains")
    .select("*")
    .eq("domain", domain)
    .eq("user_id", bot.user_id)
    .maybeSingle();

  // insert if not exists
  if (!existing) {

    await supabase
      .from("domains")
      .insert({
        domain: domain,
        user_id: bot.user_id
      });

  }

  return new Response(JSON.stringify({ allowed:true }),{
    headers:{
      "Content-Type":"application/json",
      "Access-Control-Allow-Origin":"*"
    }
  });

}