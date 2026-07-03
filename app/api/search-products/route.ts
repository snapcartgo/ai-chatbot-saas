import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // 1. Extract query parameters (Added price_query)
  const category = searchParams.get('category');
  const product_type = searchParams.get('product_type');
  const q = searchParams.get('q'); 
  const color = searchParams.get('color');
  const price_query = searchParams.get('price_query'); // <--- NEW: Read the price query string from n8n
  const user_id = searchParams.get('user_id'); 

  // 2. Enforce tenancy boundaries immediately
  if (!user_id) {
    return NextResponse.json({ error: "Missing tenant user_id authorization context." }, { status: 400 });
  }

  // 3. Initialize Supabase
  const supabase = await createSupabaseServerClient();

  // 4. Build the query and mandate user_id ownership immediately
  let query = supabase.from('products').select('*').eq('user_id', user_id); 

  // 5. Apply conditional filters (with trim and lowercase sanitation)
  if (category) query = query.ilike('category', `%${category.trim()}%`);
  if (product_type) query = query.ilike('product_type', `%${product_type.trim()}%`);
  
  if (color && color !== "") {
    query = query.ilike('color', `%${color.trim()}%`);
  }

  // ✨ NEW 5.5: Intelligent Price Filter Parser
  if (price_query && price_query !== "null" && price_query.trim() !== "") {
    const cleanPriceQuery = price_query.trim().toLowerCase();

    // Case 1: Handle "under X"
    if (cleanPriceQuery.startsWith('under')) {
      const maxPrice = parseFloat(cleanPriceQuery.replace('under', '').trim());
      if (!isNaN(maxPrice)) {
        query = query.lte('price', maxPrice); // Less than or equal to
      }
    } 
    // Case 2: Handle "exact X"
    else if (cleanPriceQuery.startsWith('exact')) {
      const exactPrice = parseFloat(cleanPriceQuery.replace('exact', '').trim());
      if (!isNaN(exactPrice)) {
        query = query.eq('price', exactPrice); // Equals
      }
    } 
    // Case 3: Handle "between X to Y"
    else if (cleanPriceQuery.startsWith('between')) {
      const numericParts = cleanPriceQuery.replace('between', '').split('to').map(num => parseFloat(num.trim()));
      const minPrice = numericParts[0];
      const maxPrice = numericParts[1];
      
      if (!isNaN(minPrice) && !isNaN(maxPrice)) {
        query = query.gte('price', minPrice).lte('price', maxPrice); // Greater than min AND Less than max
      }
    }
  }

  // 6. Intelligent General Search (Color-Resilient Wildcard & Generic Noise Fix)
  if (q) {
    let cleanQuery = q.trim().toLowerCase();
    
    // ✨ FIX: If the search query is completely generic, skip text matching entirely
    const genericWords = ["product", "products", "item", "items", "thing", "things", "all", "list"];
    
    if (!genericWords.includes(cleanQuery)) {
      const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow"];
      let queryWords = cleanQuery.split(/\s+/).filter(word => !colorAdjectives.includes(word));
      
      queryWords = queryWords.map(word => {
        if (word === "shirts" || word === "tshirt" || word === "tshirts") return "t-shirt";
        if (word === "chairs") return "chair";
        if (word === "tables") return "table";
        return word;
      });

      const finalSearchTerm = queryWords.join(" ");

      if (finalSearchTerm.length > 0) {
        query = query.or(`name.ilike.%${finalSearchTerm}%,description.ilike.%${finalSearchTerm}%,category.ilike.%${finalSearchTerm}%`);
      } else {
        query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
      }
    }
  }

  // 7. Execution and Response
  let { data, error } = await query;

  if (error) {
    console.error("Supabase Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // IF PRODUCT NOT FOUND, FETCH RELEVANT ALTERNATIVES DYNAMICALLY
  if (!data || data.length === 0) {
    // ✨ FIX: Make sure the fallback alternatives ALSO respect the budget limit!
    let altQuery = supabase.from('products').select('*').eq('user_id', user_id);

    // Apply the exact same price logic to your fallback query
    if (price_query && price_query !== "null" && price_query.trim() !== "") {
      const cleanPriceQuery = price_query.trim().toLowerCase();
      if (cleanPriceQuery.startsWith('under')) {
        const maxPrice = parseFloat(cleanPriceQuery.replace('under', '').trim());
        if (!isNaN(maxPrice)) altQuery = altQuery.lte('price', maxPrice);
      } else if (cleanPriceQuery.startsWith('exact')) {
        const exactPrice = parseFloat(cleanPriceQuery.replace('exact', '').trim());
        if (!isNaN(exactPrice)) altQuery = altQuery.eq('price', exactPrice);
      } else if (cleanPriceQuery.startsWith('between')) {
        const numericParts = cleanPriceQuery.replace('between', '').split('to').map(num => parseFloat(num.trim()));
        if (!isNaN(numericParts[0]) && !isNaN(numericParts[1])) {
          altQuery = altQuery.gte('price', numericParts[0]).lte('price', numericParts[1]);
        }
      }
    }

    const { data: alternatives, error: altError } = await altQuery.limit(3);

    if (!altError && alternatives && alternatives.length > 0) {
      return NextResponse.json({ 
        data: alternatives,
        success: true, 
        message: `We couldn't find exact matches for your keyword, but here are some options under your budget layout:` 
      });
    }

    return NextResponse.json({ 
      data: [],
      success: false,
      message: "That item is currently unavailable, and our catalog is undergoing an update. Check back soon!" 
    });
  }

  return NextResponse.json({ data, success: true, message: "Here is what we found:" });
}