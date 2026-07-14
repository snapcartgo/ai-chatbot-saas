// app/api/save-meta-config/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, meta_catalog_id, meta_access_token } = body;

    if (!user_id || !meta_catalog_id || !meta_access_token) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    // Upsert configurations matching the user_id without using updated_at
    const { error } = await supabase
      .from('whatsapp_configs')
      .upsert(
        {
          user_id,
          meta_catalog_id,
          meta_access_token,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Configuration saved successfully.' });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}