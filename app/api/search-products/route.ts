import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function POST(request: Request) {
  try {
    // 1. Extract query parameters from the URL first
    const { searchParams } = new URL(request.url);

    // 2. Safely catch incoming JSON body data if provided
    let body: any = {};
    try {
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await request.json();
      }
    } catch (e) {
      // Body empty or malformed
    }

    const firstItem = body.items && body.items[0] ? body.items[0] : {};

    // 3. Unify Parameter Extraction
    const category = searchParams.get('category') || body.category || firstItem.category || null;
    const product_type = searchParams.get('product_type') || body.product_type || firstItem.product_type || null;
    const q = searchParams.get('q') || body.q || firstItem.product_name || body.product_search || body.product_name || null; 
    const color = searchParams.get('color') || body.color || firstItem.color || null;
    const price_query = searchParams.get('price_query') || searchParams.get('price') || body.price_query || firstItem.price_query || null; 
    const user_id = searchParams.get('user_id') || body.user_id || firstItem.user_id || null; 

    // Dedicated Stock Check Parameter Extraction
    const isStockQueryParam = 
      searchParams.get('is_stock_query') === 'true' || 
      searchParams.get('stock_check') === 'true' || 
      searchParams.get('availability') === 'true' ||
      body.is_stock_query === true ||
      body.stock_check === true ||
      body.availability === true;

    // Keyword Fallback Detection
    const stockKeywords = ["stock", "available", "availability", "in stock", "have", "present", "left"];
    const queryLower = (q || '').toLowerCase();
    const isStockQuery = isStockQueryParam || stockKeywords.some((keyword) => queryLower.includes(keyword));

    // 4. Enforce tenancy boundaries immediately
    if (!user_id) {
      return NextResponse.json({ error: "Missing tenant user_id authorization context." }, { status: 400 });
    }

    // 5. Initialize Supabase
    const supabase = await createSupabaseServerClient();

    // 6. Build the initial query
    let query = supabase.from('products').select('*').eq('user_id', user_id); 

    // Store sanitized item term for category-restricted fallback
    let fallbackSearchTerm = category || product_type || "";

    // 7. Apply conditional filters
    if (category) query = query.ilike('category', `%${category.trim()}%`);
    if (product_type) query = query.ilike('product_type', `%${product_type.trim()}%`);
    
    if (color && color !== "") {
      query = query.ilike('color', `%${color.trim()}%`);
    }

    // Intelligent Price Filter Parser
    if (price_query && price_query !== "null" && price_query.trim() !== "") {
      const cleanPriceQuery = price_query.trim().toLowerCase();

      if (cleanPriceQuery.startsWith('under')) {
        const maxPrice = parseFloat(cleanPriceQuery.replace('under', '').trim());
        if (!isNaN(maxPrice)) query = query.lte('price', maxPrice);
      } else if (cleanPriceQuery.startsWith('exact')) {
        const exactPrice = parseFloat(cleanPriceQuery.replace('exact', '').trim());
        if (!isNaN(exactPrice)) query = query.eq('price', exactPrice);
      } else if (cleanPriceQuery.startsWith('between')) {
        const numericParts = cleanPriceQuery.replace('between', '').split('to').map((num: string) => parseFloat(num.trim()));
        if (!isNaN(numericParts[0]) && !isNaN(numericParts[1])) {
          query = query.gte('price', numericParts[0]).lte('price', numericParts[1]);
        }
      }
    }

    // 8. Intelligent General Search
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
        const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow", "olive green", "olive"];
        const stockNoiseWords = ["stock", "available", "availability", "in stock", "is", "are", "have", "present", "left"];

        let queryWords = cleanQuery.split(/\s+/).filter((word: string) => 
          !colorAdjectives.includes(word) && !stockNoiseWords.includes(word)
        );
        
        queryWords = queryWords.map((word: string) => {
          if (word === "shirts" || word === "tshirt" || word === "tshirts") return "t-shirt";
          if (word === "chairs") return "chair";
          if (word === "tables") return "table";
          if (word === "beds") return "bed";
          return word;
        });

        const finalSearchTerm = queryWords.join(" ");

        if (finalSearchTerm.length > 0) {
          fallbackSearchTerm = finalSearchTerm;
          query = query.or(`name.ilike.%${finalSearchTerm}%,description.ilike.%${finalSearchTerm}%,category.ilike.%${finalSearchTerm}%`);
        } else {
          fallbackSearchTerm = q.trim();
          query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
        }
      }
    }

    // 9. Execution
    let { data, error } = await query;

    if (error) {
      console.error("Supabase Query Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Helper: Build precise stock response message
    const buildStockMessage = (items: any[]) => {
      if (!items || items.length === 0) return null;
      const topProduct = items[0];
      const productName = topProduct.name || topProduct.title || (q || '').trim();
      const rawStock = topProduct.stock;

      let stockNum = 0;
      if (typeof rawStock === 'number') {
        stockNum = rawStock;
      } else if (typeof rawStock === 'string') {
        stockNum = parseInt(rawStock.replace(/[^0-9]/g, ''), 10) || 0;
      }

      if (stockNum > 0) {
        return `✅ Status: *${productName}* is in stock (${stockNum} units available).`;
      } else {
        return `❌ Status: *${productName}* is currently out of stock.`;
      }
    };

    // --- CATEGORY-AWARE FALLBACK IF NO DIRECT MATCH ---
    if (!data || data.length === 0 || isGenericSearch) {
      let altQuery = supabase.from('products').select('*').eq('user_id', user_id);
      let hasPriceFilter = false;
      let priceLabel = "";

      if (fallbackSearchTerm && !isGenericSearch) {
        altQuery = altQuery.or(`name.ilike.%${fallbackSearchTerm}%,description.ilike.%${fallbackSearchTerm}%,category.ilike.%${fallbackSearchTerm}%`);
      }

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

      let { data: alternatives, error: altError } = await altQuery;

      if ((!alternatives || alternatives.length === 0) && fallbackSearchTerm && !isGenericSearch) {
        let globalQuery = supabase.from('products').select('*').eq('user_id', user_id).limit(12);
        const { data: globalAlternatives } = await globalQuery;
        alternatives = globalAlternatives || [];
      }

      if (alternatives && alternatives.length > 0) {
        // IF STOCK QUERY WAS EXPLICITLY REQUESTED
        if (isStockQuery) {
          return NextResponse.json({
            data: alternatives,
            success: true,
            is_stock_check: true,
            message: buildStockMessage(alternatives)
          });
        }

        const searchItemName = isGenericSearch ? "products" : q ? `"${q.trim()}"` : "that item";
        let responseMessage = "";

        if (q && !isGenericSearch) {
          responseMessage = `I'm sorry, we don't have ${searchItemName} ${priceLabel ? priceLabel : ''} in that exact variant. However, here are similar options from our collection:`;
        } else if (hasPriceFilter) {
          responseMessage = `Here are the options available in our collection ${priceLabel}:`;
        } else if (isGenericSearch) {
          responseMessage = `Here are some products available in our store:`;
        } else {
          responseMessage = `I'm sorry, we don't have ${searchItemName} in our store at the moment. However, you might love these popular pieces:`;
        }

        return NextResponse.json({ 
          data: alternatives,
          success: true, 
          is_stock_check: false,
          message: responseMessage
        });
      }

      return NextResponse.json({ 
        data: [],
        success: false,
        is_stock_check: isStockQuery,
        message: q ? `We couldn't find any items matching "${q.trim()}" right now.` : "That item is currently unavailable."
      });
    }

    // --- SUCCESS RESPONSE ---
    
    // IF THIS IS A SPECIFIC STOCK QUERY
    if (isStockQuery) {
      return NextResponse.json({ 
        data, 
        success: true, 
        is_stock_check: true,
        message: buildStockMessage(data)
      });
    }

    // REGULAR SEARCH RESPONSE
    let matchMessage = "Here is what we found:";
    if (isGenericSearch && price_query) {
      matchMessage = "Here are the options available in our collection matching your budget layout:";
    }

    return NextResponse.json({ 
      data, 
      success: true, 
      is_stock_check: false,
      message: matchMessage 
    });

  } catch (err: any) {
    console.error("Critical System Route Error:", err);
    return NextResponse.json({ error: "Internal Server Processing Error", details: err.message }, { status: 500 });
  }
}