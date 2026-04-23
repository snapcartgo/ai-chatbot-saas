import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { chatbot_id, message, recipient_phone } = await req.json();

    // 1. Safety Check
    if (!chatbot_id || !message || !recipient_phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 2. Get the WhatsApp Config for this specific chatbot
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_configs')
      .select('whatsapp_access_token, whatsapp_phone_id')
      .eq('chatbot_id', chatbot_id)
      .single();

    if (configErr || !config) {
      return NextResponse.json({ error: "WhatsApp not configured for this bot" }, { status: 404 });
    }

    // 3. Trigger your n8n "Outbound" workflow
    const response = await fetch(process.env.N8N_WHATSAPP_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.whatsapp_access_token,
        phoneId: config.whatsapp_phone_id,
        recipient: recipient_phone,
        message: message
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to trigger n8n');
    }

    return NextResponse.json({ status: 'Message sent successfully' });

  } catch (error: any) {
    console.error('Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}