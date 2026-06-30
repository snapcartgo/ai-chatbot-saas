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

  // 6. Intelligent General Search (Color-Resilient Wildcard Fix)
  if (q) {
    let cleanQuery = q.trim().toLowerCase();
    
    // List of common color adjectives to filter out if they bypass text bounds
    const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow"];
    
    // Split the query into words, strip out explicit colors, and rebuild the text term
    let queryWords = cleanQuery.split(/\s+/).filter(word => !colorAdjectives.includes(word));
    
    // Handle plural normalization variations (e.g., "shirts" -> "t-shirt")
    queryWords = queryWords.map(word => {
      if (word === "shirts" || word === "tshirt" || word === "tshirts") return "t-shirt";
      if (word === "chairs") return "chair";
      if (word === "tables") return "table";
      return word;
    });

    const finalSearchTerm = queryWords.join(" ");

    // Fall back safely if the search word array is completely empty
    if (finalSearchTerm.length > 0) {
      query = query.or(`name.ilike.%${finalSearchTerm}%,description.ilike.%${finalSearchTerm}%,category.ilike.%${finalSearchTerm}%`);
    } else {
      query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
    }
  }

  // 7. Execution and Response
  let { data, error } = await query;

  if (error) {
    console.error("Supabase Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ✨ FIX: IF PRODUCT NOT FOUND, FETCH RELEVANT ALTERNATIVES DYNAMICALLY
  if (!data || data.length === 0) {
    // Fetch up to 3 random items from this specific store owner's active catalog
    const { data: alternatives, error: altError } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user_id)
      .limit(3);

    if (!altError && alternatives && alternatives.length > 0) {
      // Return the alternative products so n8n can still render them as a carousel card!
      return NextResponse.json({ 
        data: alternatives,
        success: true, // Keep it true so it flows down the existing carousel layout branch
        message: `We couldn't find "${q}". Here are some other premium items from our collection you might love:` 
      });
    }

    // Absolute fallback if the store's entire product table is completely empty
    return NextResponse.json({ 
      data: [],
      success: false,
      message: "That item is currently unavailable, and our catalog is undergoing an update. Check back soon!" 
    });
  }

  return NextResponse.json({ data, success: true, message: "Here is what we found:" });
}
 