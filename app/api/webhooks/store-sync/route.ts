import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();

  // Map incoming e-commerce data to YOUR exact Supabase schema
  const productData = {
    user_id: body.userId,
    external_id: String(body.externalId), // Unique ID from foreign store
    name: body.title,                      // Fits your 'name' column
    description: body.description,
    price: parseFloat(body.price),
    category: body.category,
    image_url: body.imageUrl,
    product_url: body.productUrl,
    sku: body.sku || null,
    stock: String(body.stock || 0),
    currency: body.currency || 'USD',
    product_type: body.productType || 'website', // Default to 'website' like your schema
    source: body.source || 'shopify',
    attributes: body.attributes || {},    // Map to your jsonb column
    allowed_options: body.allowedOptions || null,
  };

  // Upsert into Supabase based on (user_id, external_id)
  const { data, error } = await supabase
    .from('products')
    .upsert(productData, { onConflict: 'user_id, external_id' });

  if (error) {
    console.error('Error syncing product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}