import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore if called from an API Route Handler
          }
        },
      },
    }
  );
  
  try {
    const body = await req.json();
    const { 
      whatsapp_config_id, 
      name, 
      category, 
      language, 
      header_type, 
      header_content, 
      body: bodyText, 
      footer, 
      buttons 
    } = body;

    if (!whatsapp_config_id) {
      return NextResponse.json({ error: 'whatsapp_config_id is required' }, { status: 400 });
    }

    // 1. Insert the new template configuration into Supabase
    const { data, error } = await supabase
      .from('whatsapp_templates')
      .insert([{
        whatsapp_config_id,
        name,
        category,
        language,
        header_type,
        header_content,
        body: bodyText,
        footer,
        buttons,
        status: 'pending' 
      }])
      .select()
      .single();

    if (error) throw error;

    // 2. Trigger your n8n workflow here while 'data' is still in scope
    // Replace 'YOUR_N8N_WEBHOOK_URL' with your actual n8n production webhook URL
    await fetch('https://n8n.snapcartgo.com/webhook/c5e7745e-aed9-46de-851c-30ef93310922', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    });

    // 3. Return the response back to your client form
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}