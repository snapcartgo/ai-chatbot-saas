import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Twilio sends data as application/x-www-form-urlencoded
    const rawData = await req.text();
    const params = new URLSearchParams(rawData);
    
    const userMessage = params.get('Body');
    const customerPhone = params.get('From'); // Format: whatsapp:+91XXXXXXXXXX
    const twilioAccountSid = params.get('AccountSid');

    // 2. Security Validation: Prevent SSRF by validating the Account SID format
    if (!twilioAccountSid || !/^AC[a-fA-F0-9]{32}$/.test(twilioAccountSid)) {
      return new Response('<Response></Response>', { 
        headers: { 'Content-Type': 'text/xml' } 
      });
    }

    if (!userMessage) return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });

    // 3. Find Config in Supabase using the validated Twilio Account SID
    // Make sure you select 'phone_number' here!
const { data: config, error: configErr } = await supabase
  .from('whatsapp_configs')
  .select('chatbot_id, twilio_auth_token, twilio_sid, phone_number') // ADD THIS
  .eq('twilio_sid', twilioAccountSid)
  .single();

    if (configErr || !config) return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });

    // 4. Get AI settings from the chatbots table
    const { data: bot } = await supabase
      .from('chatbots')
      .select('id, name, prompt')
      .eq('id', config.chatbot_id)
      .single();

    // 5. Check for existing Lead (stripping prefix for matching database numbers)
    const purePhone = customerPhone?.replace('whatsapp:', '');
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', purePhone)
      .single();

    // 6. Generate AI Response
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
                { role: "user", content: `Customer Context: ${JSON.stringify(lead || "New Customer")}\n\nMessage: ${userMessage}` }
            ]
        })
    }).then(res => res.json()).then(data => data.choices[0].message.content);

    // 7. Send reply via Twilio API
    // Sanitize the SID in the URL to pass security checks
    const twilioMessageUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.twilio_sid)}/Messages.json`;
    
    await fetch(twilioMessageUrl, {
      method: 'POST',
      headers: {
        // Twilio uses Basic Auth (SID:Token)
        'Authorization': 'Basic ' + Buffer.from(`${config.twilio_sid}:${config.twilio_auth_token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: customerPhone!,
        From: config.phone_number || 'whatsapp:+14155238886', 
        Body: aiResponse
      })
    });

    // 8. Return TwiML XML to Twilio
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  }
}