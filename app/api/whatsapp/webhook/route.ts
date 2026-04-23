import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const entry = body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    const metadata = entry?.metadata;

    if (!message?.text?.body) return NextResponse.json({ status: 'ignored' });

    const customerPhone = message.from; // This defines the missing variable
    const phoneId = metadata.phone_number_id;

    // 1. Find Config in your NEW bridge table
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_configs')
      .select('chatbot_id, whatsapp_access_token')
      .eq('whatsapp_phone_id', phoneId)
      .single();

    if (configErr || !config) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    // 2. Get AI settings from the UNTOUCHED chatbots table
    const { data: bot } = await supabase
      .from('chatbots')
      .select('id, name, prompt')
      .eq('id', config.chatbot_id)
      .single();

    // 3. Check for existing Lead/Booking
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', customerPhone)
      .single();

    // 4. Generate AI Response logic (Replaces the missing yourAiBrain error)
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: bot?.prompt || "You are a helpful assistant." },
                { role: "user", content: `Customer Context: ${JSON.stringify(lead || "New Customer")}\n\nMessage: ${message.text.body}` }
            ]
        })
    }).then(res => res.json()).then(data => data.choices[0].message.content);

    // 5. Trigger n8n
    await fetch(process.env.N8N_WHATSAPP_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.whatsapp_access_token,
        phoneId: phoneId,
        recipient: customerPhone,
        message: aiResponse
      }),
    });

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

// Keep the GET handler for Meta Verification as well
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(searchParams.get('hub.challenge'));
    }
    return new Response('Error', { status: 403 });
}