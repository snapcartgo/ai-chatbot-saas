import { NextResponse } from 'next/server';
// import { supabase } from '@/lib/supabase'; // 👈 Import your database client here

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // 1. Extract the Veblika API Key sent by n8n in the headers
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Veblika API Key' }, { status: 401 });
        }

        const apiKey = authHeader.replace('Bearer ', '').trim();

        // 2. Fetch the specific user's Meta Token and Phone ID from your database
        // This keeps your platform dynamic so every user can send via their own WhatsApp account
        /*
        const { data: userConfig, error: dbError } = await supabase
            .from('whatsapp_settings')
            .select('meta_access_token, phone_number_id')
            .eq('api_key', apiKey)
            .single();

        if (dbError || !userConfig) {
            return NextResponse.json({ error: 'Invalid Veblika API Key or missing configuration' }, { status: 401 });
        }
        */

        // For testing right now, you can temporarily assign your active tokens here:
        const META_PERMANENT_ACCESS_TOKEN = "EAA9jJndmp3QBQXrV14fVnrgS49yZCV0Cdoky3MI49KKspjEWUht09rsQOMqZB8j3VKcLQbRzi0Y6AeRfdvzeyWPNdbxxFEdoTGEhI8DSBxT7yGQKPhMyY7WGbckIokeKx1IDGzN5TgaxAml20bTsoQLotywhOiyZCH0BK8le92IjHjyevbtDTzjfNJitaW2TwZDZD";
        const phoneId = body.phone_number_id || "1039438675915510"; 

        if (!phoneId) {
            return NextResponse.json({ error: 'Missing phone_number_id' }, { status: 400 });
        }

        // 3. Forward the raw Meta payload straight to Meta's Graph API
        const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${META_PERMANENT_ACCESS_TOKEN}` // Uses the validated Meta token
            },
            body: JSON.stringify(body)
        });

        const data = await metaResponse.json();
        
        // Return Meta's direct response back to n8n
        return NextResponse.json(data, { status: metaResponse.status });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}