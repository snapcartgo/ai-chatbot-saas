import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Extract query parameters
  const category = searchParams.get('category');
  const product_type = searchParams.get('product_type');
  const q = searchParams.get('q'); 
  const color = searchParams.get('color');
  const user_id = searchParams.get('user_id'); // <--- CRITICAL: Get user_id from query string

  // 2. Enforce tenancy boundaries immediately
  if (!user_id) {
    return NextResponse.json({ error: "Missing tenant user_id authorization context." }, { status: 400 });
  }

  // 3. Initialize Supabase
  const supabase = await createSupabaseServerClient();

  // 4. Build the query and mandate user_id ownership immediately
  let query = supabase.from('products').select('*').eq('user_id', user_id); // <--- CRITICAL FIX

  // 5. Apply conditional filters
  if (category) query = query.ilike('category', `%${category}%`);
  if (product_type) query = query.ilike('product_type', `%${product_type}%`);
  
  if (color && color !== "") {
    query = query.ilike('color', `%${color}%`);
  }

  // 6. General Search using grouped .or() validation (Plural-Resilient Fix)
  if (q) {
    let cleanQuery = q.trim();
    
    // If the query ends with "shirts" or "jeans" variations, make it a singular wildcard check
    if (cleanQuery.toLowerCase().endsWith("shirts")) {
      cleanQuery = cleanQuery.slice(0, -1); // Converts "T-Shirts" -> "T-Shirt"
    }
    
    query = query.or(`name.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`);
  }

  // 7. Execution and Response
  const { data, error } = await query;

  if (error) {
    console.error("Supabase Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}