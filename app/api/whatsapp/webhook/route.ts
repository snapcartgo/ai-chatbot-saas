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
    
    // Extracting fields sent by Twilio
    const userMessage = params.get('Body');
    const customerPhone = params.get('From'); // Format: whatsapp:+91XXXXXXXXXX
    const twilioAccountSid = params.get('AccountSid');

    if (!userMessage) return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });

    // 2. Find Config in your bridge table using the Twilio Account SID
    // Ensure your 'whatsapp_configs' table has a column for 'twilio_sid'
    const { data: config, error: configErr } = await supabase
      .from('whatsapp_configs')
      .select('chatbot_id, twilio_auth_token')
      .eq('twilio_sid', twilioAccountSid)
      .single();

    if (configErr || !config) return NextResponse.json({ error: 'Config Not Found' }, { status: 404 });

    // 3. Get AI settings from the chatbots table
    const { data: bot } = await supabase
      .from('chatbots')
      .select('id, name, prompt')
      .eq('id', config.chatbot_id)
      .single();

    // 4. Check for existing Lead (strip "whatsapp:" prefix for matching digits if necessary)
    const purePhone = customerPhone?.replace('whatsapp:', '');
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', purePhone)
      .single();

    // 5. Generate AI Response logic
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

    // 6. Trigger n8n or send via Twilio API
    // Twilio requires "Basic Auth" using AccountSID:AuthToken
    const twilioMessageUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    await fetch(twilioMessageUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${twilioAccountSid}:${config.twilio_auth_token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        To: customerPhone!, // e.g., whatsapp:+919878498214
        From: 'whatsapp:+14155238886', // Your Twilio Sandbox number
        Body: aiResponse
      })
    });

    // 7. Twilio expects a TwiML XML response (even if empty)
    return new Response('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Webhook Error:', error);
    return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
  }
}

// DELETE the GET handler if you are no longer using Meta. 
// Twilio does not require a verification challenge for sandboxes.