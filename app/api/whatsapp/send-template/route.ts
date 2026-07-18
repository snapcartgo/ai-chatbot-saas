import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// 🔗 REPLACE THIS STRING WITH YOUR EXACT N8N WEBHOOK URL FROM YOUR SCREENSHOT:
const N8N_WEBHOOK_URL = "https://n8n.snapcartgo.com/webhook/9d326183-431f-4590-b0d3-21976e11beec";

export async function POST(req: Request) {
  try {
    const { templateName, languageCode, recipientPhone } = await req.json();

    if (!templateName || !languageCode || !recipientPhone) {
      return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
    }

    // 1. Grab WhatsApp access variables dynamically from the database
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .not('whatsapp_access_token', 'is', null)
      .limit(1)
      .single();

    if (configError || !config) {
      console.error("Configuration lookup error:", configError);
      return NextResponse.json({ error: 'WhatsApp configurations not found.' }, { status: 404 });
    }

    // 2. Format variables cleanly for Meta's API payload rules
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    const cleanLanguage = languageCode.replace('-', '_'); 
    const PHONE_NUMBER_ID = config.wa_phone_number_id;
    const TOKEN = config.whatsapp_access_token;

    // 3. Forward everything to your n8n workflow instead of hitting Meta directly
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number_id: PHONE_NUMBER_ID,
        whatsapp_access_token: TOKEN,
        recipient_number: cleanPhone,
        template_name: templateName,
        language_code: cleanLanguage
      })
    });

    if (!n8nResponse.ok) {
      const n8nErrorText = await n8nResponse.text();
      console.error("❌ n8n Webhook rejected the call:", n8nErrorText);
      return NextResponse.json({ error: 'n8n workflow execution failed', details: n8nErrorText }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Forwarded to n8n successfully." });
  } catch (error: any) {
    console.error('Template Sending Proxy Crash:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}