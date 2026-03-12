import { createClient } from "@supabase/supabase-js";

export async function GET(req) {

  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("botId");
  const domain = searchParams.get("domain");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data } = await supabase
    .from("domains")
    .select("*")
    .eq("domain", domain)
    .single();

  const allowed = !!data;

  return new Response(
    JSON.stringify({ allowed }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}