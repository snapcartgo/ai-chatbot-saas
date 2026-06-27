import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Extract query parameters
  const category = searchParams.get('category');
  const product_type = searchParams.get('product_type');
  const q = searchParams.get('q'); // Combined search parameter

  // 2. Initialize Supabase
  const supabase = await createSupabaseServerClient();

  // 3. Build the query
  let query = supabase.from('products').select('*');

  // 4. Apply conditional filters
  if (category) query = query.ilike('category', `%${category}%`);
  if (product_type) query = query.ilike('product_type', `%${product_type}%`);

  // 5. Corrected General Search using .or()
  // Syntax: 'column.ilike.%value%,column.ilike.%value%'
  if (q) {
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }

  // 6. Execution and Response
  const { data, error } = await query;

  if (error) {
    console.error("Supabase Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}