import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // 1. Initialize the cookie store correctly for Next.js
  const cookieStore = await cookies();

  // 2. Create the Supabase client using the modern SSR approach
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
            // The setAll method can be ignored if called from Middleware or Server Components
          }
        },
      },
    }
  );

  try {
    // 3. Extract the data from the incoming request
    const { waba_id, phone_number_id, client_id } = await req.json();

    // 4. Perform the upsert with a type-cast ('as any') to bypass local schema errors
    const { error } = await supabase
      .from('whatsapp_configs')
      .upsert({
        id: client_id,
        waba_id: waba_id,
        wa_phone_number: phone_number_id, // Matches the 'wa_phone_number' column in your image_b5f25e.png
        status: 'active',
      } as any);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}