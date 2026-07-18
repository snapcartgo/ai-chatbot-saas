import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function POST(request: Request) {
  try {
    // 1. Extract query parameters from the URL first (keeps existing n8n setups working)
    const { searchParams } = new URL(request.url);

    // 2. Safely catch incoming JSON body data if provided, preventing crashes if it's empty
    let body: any = {};
    try {
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await request.json();
      }
    } catch (e) {
      // Body empty or malformed; swallow exception and fallback to URL query strings
    }

    const firstItem = body.items && body.items[0] ? body.items[0] : {};

    // 3. Unify Extraction: Check URL params first, then check JSON body variants
    const category = searchParams.get('category') || body.category || firstItem.category || null;
    const product_type = searchParams.get('product_type') || body.product_type || firstItem.product_type || null;
    const q = searchParams.get('q') || body.q || firstItem.product_name || null; 
    const color = searchParams.get('color') || body.color || firstItem.color || null;
    const price_query = searchParams.get('price_query') || searchParams.get('price') || body.price_query || firstItem.price_query || null; 
    const user_id = searchParams.get('user_id') || body.user_id || firstItem.user_id || null; 

    // 4. Enforce tenancy boundaries immediately
    if (!user_id) {
      return NextResponse.json({ error: "Missing tenant user_id authorization context." }, { status: 400 });
    }

    // 5. Initialize Supabase
    const supabase = await createSupabaseServerClient();

    // 6. Build the query and mandate user_id ownership immediately
    let query = supabase.from('products').select('*').eq('user_id', user_id); 

    // 7. Apply conditional filters (with trim and lowercase sanitation)
    if (category) query = query.ilike('category', `%${category.trim()}%`);
    if (product_type) query = query.ilike('product_type', `%${product_type.trim()}%`);
    
    if (color && color !== "") {
      query = query.ilike('color', `%${color.trim()}%`);
    }

    // ✨ Intelligent Price Filter Parser
    if (price_query && price_query !== "null" && price_query.trim() !== "") {
      const cleanPriceQuery = price_query.trim().toLowerCase();

      // Case 1: Handle "under X"
      if (cleanPriceQuery.startsWith('under')) {
        const maxPrice = parseFloat(cleanPriceQuery.replace('under', '').trim());
        if (!isNaN(maxPrice)) {
          query = query.lte('price', maxPrice);
        }
      } 
      // Case 2: Handle "exact X"
      else if (cleanPriceQuery.startsWith('exact')) {
        const exactPrice = parseFloat(cleanPriceQuery.replace('exact', '').trim());
        if (!isNaN(exactPrice)) {
          query = query.eq('price', exactPrice);
        }
      } 
      // Case 3: Handle "between X to Y"
      else if (cleanPriceQuery.startsWith('between')) {
        const numericParts = cleanPriceQuery.replace('between', '').split('to').map((num: string) => parseFloat(num.trim()));
        const minPrice = numericParts[0];
        const maxPrice = numericParts[1];
        
        if (!isNaN(minPrice) && !isNaN(maxPrice)) {
          query = query.gte('price', minPrice).lte('price', maxPrice);
        }
      }
    }

    // 8. Intelligent General Search (Color-Resilient Wildcard & Generic Noise Fix)
    let isGenericSearch = false; 

    if (q) {
      let cleanQuery = q.trim().toLowerCase();
      const genericWords = [
        "product", "products", "item", "items", "thing", "things", 
        "all", "list", "any", "any product", "available products", "available product"
      ];
      
      if (genericWords.includes(cleanQuery)) {
        isGenericSearch = true;
      } else {
        const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow"];
        let queryWords = cleanQuery.split(/\s+/).filter((word: string) => !colorAdjectives.includes(word));
        
        queryWords = queryWords.map((word: string) => {
          if (word === "shirts" || word === "tshirt" || word === "tshirts") return "t-shirt";
          if (word === "chairs") return "chair";
          if (word === "tables") return "table";
          if (word === "beds") return "bed";
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

    // 9. Execution and Response
    let { data, error } = await query;

    if (error) {
      console.error("Supabase Query Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // --- SOLUTION 2: FALLBACK TRIGGERED IF NO RESULTS FOUND OR GENERIC SEARCH ---
    if (!data || data.length === 0 || isGenericSearch) {
      let altQuery = supabase.from('products').select('*').eq('user_id', user_id);
      let hasPriceFilter = false;
      let priceLabel = "";

      if (price_query && price_query !== "null" && price_query.trim() !== "") {
        const cleanPriceQuery = price_query.trim().toLowerCase();
        if (cleanPriceQuery.startsWith('under')) {
          const maxPrice = parseFloat(cleanPriceQuery.replace('under', '').trim());
          if (!isNaN(maxPrice)) {
            altQuery = altQuery.lte('price', maxPrice);
            hasPriceFilter = true;
            priceLabel = `under Rs. ${maxPrice}`;
          }
        } else if (cleanPriceQuery.startsWith('exact')) {
          const exactPrice = parseFloat(cleanPriceQuery.replace('exact', '').trim());
          if (!isNaN(exactPrice)) {
            altQuery = altQuery.eq('price', exactPrice);
            hasPriceFilter = true;
            priceLabel = `at exactly Rs. ${exactPrice}`;
          }
        } else if (cleanPriceQuery.startsWith('between')) {
          const numericParts = cleanPriceQuery.replace('between', '').split('to').map((num: string) => parseFloat(num.trim()));
          if (!isNaN(numericParts[0]) && !isNaN(numericParts[1])) {
            altQuery = altQuery.gte('price', numericParts[0]).lte('price', numericParts[1]);
            hasPriceFilter = true;
            priceLabel = `between Rs. ${numericParts[0]} to Rs. ${numericParts[1]}`;
          }
        }
      }

      altQuery = altQuery.limit(12);

      const { data: alternatives, error: altError } = await altQuery; 

      if (!altError && alternatives && alternatives.length > 0) {
        const searchItemName = isGenericSearch ? "products" : q ? `"${q.trim()}"` : "that item";
        let responseMessage = "";

        if (q && !isGenericSearch) {
          responseMessage = `I'm sorry, we don't have ${searchItemName} ${priceLabel ? priceLabel : ''} in our store at the moment. However, you might love these options from our collection:`;
        } else if (hasPriceFilter) {
          responseMessage = `Here are the options available in our collection ${priceLabel}:`;
        } else if (isGenericSearch) {
          responseMessage = `Here are some products available in our store:`;
        } else {
          responseMessage = `I'm sorry, we don't have ${searchItemName} in our store at the moment. However, you might love these popular pieces from our collection:`;
        }

        return NextResponse.json({ 
          data: alternatives,
          success: true, 
          message: responseMessage
        });
      }

      return NextResponse.json({ 
        data: [],
        success: false,
        message: q ? `We couldn't find any items matching "${q.trim()}" right now.` : "That item is currently unavailable."
      });
    }

    // If initial explicit search criteria matched perfectly
    let matchMessage = "Here is what we found:";
    if (isGenericSearch && price_query) {
      matchMessage = "Here are the options available in our collection matching your budget layout:";
    }

    return NextResponse.json({ data, success: true, message: matchMessage });

  } catch (err: any) {
    console.error("Critical System Route Error:", err);
    return NextResponse.json({ error: "Internal Server Processing Error", details: err.message }, { status: 500 });
  }
}