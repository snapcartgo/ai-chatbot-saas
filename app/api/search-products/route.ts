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
      body.is_stock_query === true || body.is_stock_query === 'true' ||
      body.stock_check === true || body.stock_check === 'true' ||
      body.availability === true || body.availability === 'true';

    const stockKeywords = ["stock", "available", "availability", "in stock", "have", "present", "left", "do you have"];
    const queryLower = (q || '').toLowerCase();
    const isStockQuery = isStockQueryParam || stockKeywords.some((keyword) => queryLower.includes(keyword));

    // 4. Enforce tenancy boundaries immediately
    if (!user_id) {
      return NextResponse.json({ error: "Missing tenant user_id authorization context." }, { status: 400 });
    }

    // 5. Initialize Supabase
    const supabase = await createSupabaseServerClient();

    // Helper to safely parse numerical stock values
    const getStockCount = (item: any) => {
      const raw = item?.stock;
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') return parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
      return 0;
    };

    // 6. Build the initial query
    let query = supabase.from('products').select('*').eq('user_id', user_id); 

    let fallbackSearchTerm = category || product_type || "";

    // 7. Apply conditional filters
    if (category) query = query.ilike('category', `%${category.trim()}%`);
    if (product_type) query = query.ilike('product_type', `%${product_type.trim()}%`);
    if (color && color !== "") query = query.ilike('color', `%${color.trim()}%`);

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
        const stockNoiseWords = ["stock", "available", "availability", "in stock", "is", "are", "have", "present", "left", "do", "you"];

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

    // =========================================================================
    // DYNAMIC STOCK & ALTERNATIVE ITEM HANDLING
    // =========================================================================
    const requestedItemName = (q || fallbackSearchTerm || 'item').trim();

    // Check if the specific search returned item(s) that are ALL OUT OF STOCK (stock = 0)
    const matchedItems = data || [];
    const isExactMatchOutOfStock = matchedItems.length > 0 && matchedItems.every(item => getStockCount(item) === 0);

    if (isExactMatchOutOfStock || matchedItems.length === 0) {
      // Find available alternative products from the same category/store that DO have stock > 0
      let altQuery = supabase.from('products').select('*').eq('user_id', user_id);

      if (fallbackSearchTerm && !isGenericSearch) {
        altQuery = altQuery.or(`name.ilike.%${fallbackSearchTerm}%,description.ilike.%${fallbackSearchTerm}%,category.ilike.%${fallbackSearchTerm}%`);
      }

      const { data: altData } = await altQuery;
      const inStockAlternatives = (altData || []).filter(item => getStockCount(item) > 0);

      // Construct user-friendly messaging
      let responseMessage = `I'm sorry, right now *${requestedItemName}* is out of stock. As soon as the stock is available, I will let you know!`;

      if (inStockAlternatives.length > 0) {
        responseMessage += ` In the meantime, we have some other options available in our collection:`;
      }

      return NextResponse.json({
        data: inStockAlternatives.length > 0 ? inStockAlternatives : matchedItems,
        success: true,
        is_stock_check: true,
        message: responseMessage
      });
    }

    // If matching items ARE in stock, filter the carousel to only display in-stock items
    const inStockItems = matchedItems.filter(item => getStockCount(item) > 0);
    const topInStockItem = inStockItems[0] || matchedItems[0];
    const topProductName = topInStockItem.name || topInStockItem.title || requestedItemName;
    const stockNum = getStockCount(topInStockItem);

    let matchMessage = isStockQuery 
      ? `✅ Yes, *${topProductName}* is available in stock (${stockNum} units available).`
      : "Here is what we found:";

    return NextResponse.json({ 
      data: inStockItems, 
      success: true, 
      is_stock_check: isStockQuery,
      message: matchMessage 
    });

  } catch (err: any) {
    console.error("Critical System Route Error:", err);
    return NextResponse.json({ error: "Internal Server Processing Error", details: err.message }, { status: 500 });
  }
}