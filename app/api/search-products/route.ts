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

 // 5. Apply conditional filters (with trim and lowercase sanitation)
  if (category) query = query.ilike('category', `%${category.trim()}%`);
  if (product_type) query = query.ilike('product_type', `%${product_type.trim()}%`);
  
  if (color && color !== "") {
    query = query.ilike('color', `%${color.trim()}%`);
  }

  // 6. Intelligent General Search (Plural-Resilient & Multi-Column Fallback)
  if (q) {
    const originalQuery = q.trim();
    // Create a singular fallback version (e.g., "chairs" -> "chair", "tshirts" -> "t-shirt")
    let singularQuery = originalQuery.toLowerCase();
    if (singularQuery.endsWith("shirts")) singularQuery = "t-shirt";
    else if (singularQuery.endsWith("s")) singularQuery = singularQuery.slice(0, -1);

    // Expand the OR query to check names, descriptions, and the category column using wildcards
    query = query.or(
      `name.ilike.%${originalQuery}%,` +
      `description.ilike.%${originalQuery}%,` +
      `category.ilike.%${originalQuery}%,` +
      `name.ilike.%${singularQuery}%,` +
      `description.ilike.%${singularQuery}%,` +
      `category.ilike.%${singularQuery}%`
    );
  }

  // 7. Execution and Response
  const { data, error } = await query;

  if (error) {
    console.error("Supabase Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}