import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // 1. Get the Veblika API Key from headers
        const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Veblika API Key' }, { status: 401 });
        }

        // 2. Define your actual Permanent Meta Access Token here
        const META_PERMANENT_ACCESS_TOKEN = "EAA9jJndmp3QBQXrV14fVnrgS49yZCV0Cdoky3MI49KKspjEWUht09rsQOMqZB8j3VKcLQbRzi0Y6AeRfdvzeyWPNdbxxFEdoTGEhI8DSBxT7yGQKPhMyY7WGbckIokeKx1IDGzN5TgaxAml20bTsoQLotywhOiyZCH0BK8le92IjHjyevbtDTzjfNJitaW2TwZDZD";

        // 3. Extract and SANITIZE the phone number ID to fix the SSRF vulnerability
        const rawPhoneId = body.phone_number_id; 
        if (!rawPhoneId) {
            return NextResponse.json({ error: 'Missing phone_number_id' }, { status: 400 });
        }

        // Force it to a string and use regex to ensure it contains ONLY digits (0-9)
        const phoneId = String(rawPhoneId).trim();
        const isValidMetaId = /^\d+$/.test(phoneId);

        if (!isValidMetaId) {
            return NextResponse.json({ error: 'Invalid phone_number_id format. Must be numeric.' }, { status: 400 });
        }

        // 4. Forward to Meta using the clean token format Meta expects
const metaResponse = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        // Change this line to pass your token directly:
        'Authorization': `Bearer ${META_PERMANENT_ACCESS_TOKEN.replace('Bearer ', '').trim()}`
    },
    body: JSON.stringify(body)
});

        const data = await metaResponse.json();
        return NextResponse.json(data, { status: metaResponse.status });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}