import { NextResponse } from 'next/server';
// Use the relative path to avoid tsconfig alias issues
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Extract query parameters
  const product_type = searchParams.get('product_type');
  const color = searchParams.get('color');
  const size = searchParams.get('size');
  const price = searchParams.get('price');
  const sku = searchParams.get('sku');
  const category = searchParams.get('category');

  // 2. Initialize Supabase using your server client
  const supabase = await createSupabaseServerClient();

  // 3. Build the query
  let query = supabase.from('products').select('*');

  // 4. Apply conditional filters
  if (product_type) query = query.eq('product_type', product_type);
  if (color) query = query.eq('color', color);
  if (size) query = query.eq('size', size);
  if (sku) query = query.eq('sku', sku);
  if (category) query = query.eq('category', category);
  
  if (price) {
    const numericPrice = parseFloat(price);
    if (!isNaN(numericPrice)) {
      query = query.lte('price', numericPrice);
    }
  }

  // 5. Execution and Response
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}