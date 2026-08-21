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

    // Extract quantity (default to 1)
    const rawQuantity = searchParams.get('quantity') || body.quantity || firstItem.quantity || 1;
    const quantity = parseInt(String(rawQuantity), 10) || 1;

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
    // Multi-color parser
    // Multi-color parser
    const rawColors = color
      ? color.split(',').map((c: string) => c.trim().toLowerCase()).filter(Boolean)
      : [];

    const requestedColors = rawColors.filter((c: string) => !(q || '').toLowerCase().includes(c));

    // Use .in() filter instead of .or() to prevent cross-table OR condition leaks
    if (requestedColors.length === 1) {
      query = query.ilike('color', `%${requestedColors[0]}%`);
    } else if (requestedColors.length > 1) {
      const formattedColors = requestedColors.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1));
      query = query.in('color', [...requestedColors, ...formattedColors]);
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
        "all", "list", "any", "any product", "available products", "available product",
        "all products", "all product"
      ];
      
      if (genericWords.includes(cleanQuery)) {
        isGenericSearch = true;
      } else {
        // 1. Split across commas, "and", and "or"
        const rawItems = cleanQuery
          .split(/(?:,|\band\b|\bor\b)/gi)
          .map((item: string) => item.trim())
          .filter(Boolean);

        const stockNoiseWords = ["stock", "available", "availability", "in stock", "is", "are", "have", "present", "left", "do", "you", "sell", "show", "me"];

        const conditions: string[] = [];

        rawItems.forEach((itemStr: string) => {
          let words = itemStr.split(/\s+/).filter((word: string) => 
            !stockNoiseWords.includes(word)
          );
          
          // Normalize plurals/synonyms
          words = words.map((word: string) => {
            if (["shirts", "tshirt", "tshirts", "t-shirts"].includes(word)) return "t-shirt";
            if (["chairs", "armchairs", "armchair"].includes(word)) return "chair";
            if (["tables"].includes(word)) return "table";
            if (["beds"].includes(word)) return "bed";
            if (["caps", "hats"].includes(word)) return "cap";
            return word;
          });

          // Match keywords across name, description, and category
          words.forEach((w: string) => {
            if (w.length > 2) {
              conditions.push(`name.ilike.%${w}%`);
              conditions.push(`description.ilike.%${w}%`);
              conditions.push(`category.ilike.%${w}%`);
            }
          });
        });

        if (conditions.length > 0) {
          fallbackSearchTerm = rawItems.join(", ");
          query = query.or(conditions.join(','));
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
    // RELEVANCE SCORING & SORTING (Added to rank exact/best matches first)
    // =========================================================================
    let matchedItems = data || [];

    if (q && !isGenericSearch && matchedItems.length > 1) {
      const searchTerms = q.toLowerCase().split(/\s+/).filter(Boolean);

       matchedItems = matchedItems.sort((a: any, b: any) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const cleanQ = q.trim().toLowerCase();

        // 1. Exact full name match gets top priority
        if (nameA === cleanQ) return -1;
        if (nameB === cleanQ) return 1;

        // 2. Full search phrase inclusion
        if (nameA.includes(cleanQ) && !nameB.includes(cleanQ)) return -1;
        if (!nameA.includes(cleanQ) && nameB.includes(cleanQ)) return 1;

        // 3. Score based on matching individual keyword count
        const scoreA = searchTerms.reduce((count: number, term: string) => count + (nameA.includes(term) ? 1 : 0), 0);
        const scoreB = searchTerms.reduce((count: number, term: string) => count + (nameB.includes(term) ? 1 : 0), 0);

        return scoreB - scoreA;
      });
    }

    // =========================================================================
    // DYNAMIC STOCK & ALTERNATIVE ITEM HANDLING
    // =========================================================================
    const requestedItemName = (q || fallbackSearchTerm || 'item').trim();

    // Check if the specific search returned item(s) that are ALL OUT OF STOCK (stock = 0)
    const isExactMatchOutOfStock = matchedItems.length > 0 && matchedItems.every(item => getStockCount(item) === 0);
    const noExactMatchFound = matchedItems.length === 0;

    if (isExactMatchOutOfStock || noExactMatchFound) {
      // Find available alternative products from the same category/store that DO have stock > 0
      let altQuery = supabase.from('products').select('*').eq('user_id', user_id);

      if (fallbackSearchTerm && !isGenericSearch) {
        altQuery = altQuery.or(`name.ilike.%${fallbackSearchTerm}%,description.ilike.%${fallbackSearchTerm}%,category.ilike.%${fallbackSearchTerm}%`);
      }

      const { data: altData } = await altQuery;
      const inStockAlternatives = (altData || []).filter(item => getStockCount(item) > 0);

      // Construct user-friendly messaging
      let responseMessage = "";
      
      // Include color in the unavailable message if a color filter was provided
      const itemLabel = color ? `${color} ${requestedItemName}` : requestedItemName;

      if (noExactMatchFound || isExactMatchOutOfStock) {
        responseMessage = `I'm sorry, right now *${itemLabel}* is out of stock. As soon as the stock is available, I will let you know!`;
      }

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
    // Extract base item name keywords (e.g., "t-shirt", "tshirt", "jeans")
    const cleanSearchQuery = (q || fallbackSearchTerm || '').toLowerCase();

    // Split multi-item queries into discrete requested product phrases (e.g., ["cap", "live-edge walnut coffee table"])
    const rawRequestedPhrases = (q || fallbackSearchTerm || '')
      .split(/(?:,|\band\b|\bor\b)/gi)
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s.length > 0);

    const inStockItems = matchedItems
      .filter((item: any) => {
        if (!q || isGenericSearch) return true;

        const itemName = (item.name || '').toLowerCase().trim();
        const itemCategory = (item.category || '').toLowerCase().trim();
        const itemDesc = (item.description || '').toLowerCase().trim();
        const fullItemText = `${itemName} ${itemCategory} ${itemDesc}`;

        return rawRequestedPhrases.some((phrase: string) => {
          const cleanPhrase = phrase.toLowerCase().trim();

          // 1. Conflict Prevention: If query specifies "dining", exclude pure coffee tables
          if (cleanPhrase.includes('dining') && !cleanPhrase.includes('coffee')) {
            if (itemCategory.includes('coffee') || itemName.includes('coffee table')) {
              return false;
            }
          }

          // 2. Direct exact phrase match in Name or Category
          if (fullItemText.includes(cleanPhrase)) return true;

          // 3. Category match
          if (itemCategory.includes(cleanPhrase)) return true;

          const phraseWords = cleanPhrase.split(/\s+/).filter((w: string) => w.length > 2);

          if (phraseWords.length === 1) {
            return fullItemText.includes(phraseWords[0]);
          }

          // 4. For multi-word queries, ALL significant words must match
          const matchedCount = phraseWords.filter((w: string) => fullItemText.includes(w)).length;
          return matchedCount === phraseWords.length;
        });
      })
      .filter((item: any) => getStockCount(item) > 0);

    // Empty result guard: Prevents showing wrong fallback items
    if (inStockItems.length === 0) {
      return NextResponse.json({
        data: [],
        success: true,
        is_stock_check: isStockQuery,
        quantity: quantity,
        total_price: 0,
        message: `No products found matching "${q || fallbackSearchTerm || 'your criteria'}" under the requested price.`
      });
    }

    const topInStockItem = inStockItems[0];
    const topProductName = topInStockItem.name;
    const stockNum = getStockCount(topInStockItem);
    const currencySymbol = topInStockItem.currency || '$';

    // Attach computed total prices to matched items
    const enrichedItems = inStockItems.map((item: any) => {
      const unitPrice = parseFloat(item.price) || 0;
      return {
        ...item,
        quantity_requested: quantity,
        unit_price: unitPrice,
        total_price: unitPrice * quantity
      };
    });

    let matchMessage = "Here is what we found:";

if (isStockQuery) {
  // 1. Check if multiple distinct products were queried (e.g. "Cap, Live-Edge Walnut Coffee Table")
  const requestedItems = q
    ? q.split(/(?:,|\band\b|\bor\b)/gi).map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  if (requestedItems.length > 1) {
    const matchedNames = inStockItems.map((i: any) => (i.name || '').toLowerCase());
    const availableList = inStockItems
      .map((i: any) => `*${i.name}* (${getStockCount(i)} units)`)
      .join(', ');

    const missingItems = requestedItems.filter(
      (req: string) => !matchedNames.some((m: string) => m.includes(req) || req.includes(m))
    );

    if (missingItems.length > 0 && inStockItems.length > 0) {
      const missingFormatted = missingItems
        .map((m: string) => `*${m.charAt(0).toUpperCase() + m.slice(1)}*`)
        .join(', ');
      matchMessage = `✅ Yes, ${availableList} is available in stock, but ${missingFormatted} is currently out of stock.`;
    } else if (inStockItems.length > 0) {
      matchMessage = `✅ Yes, all requested items are in stock: ${availableList}.`;
    }
  } else if (requestedColors.length > 1) {
    // 2. Multi-color handling for a single product
    const availableColors = inStockItems.map((i: any) => (i.color || '').toLowerCase());
    const availableSummary = inStockItems
      .map((i: any) => `${i.color || 'Standard'} (${getStockCount(i)} units)`)
      .join(', ');

    const missingColors = requestedColors.filter(
      (c: string) => !availableColors.some((ac: string) => ac.includes(c))
    );

    if (missingColors.length > 0) {
      matchMessage = `✅ *${topProductName}* is available in ${availableSummary}, but *${missingColors.join(', ')}* is currently out of stock.`;
    } else {
      matchMessage = `✅ Yes, *${topProductName}* is available in stock: ${availableSummary}.`;
    }
  } else {
    // 3. Standard single-item stock message
    matchMessage = `✅ Yes, *${topProductName}* is available in stock (${stockNum} units available).`;
  }
}else if (price_query || queryLower.includes('price') || queryLower.includes('cost') || quantity > 1) {
  const unitPrice = parseFloat(topInStockItem?.price || 0);
  const totalPrice = unitPrice * quantity;
  
  if (quantity > 1) {
    matchMessage = `The total price for ${quantity}x *${topProductName}* is **Rs. ${totalPrice}** (Rs. ${unitPrice} each).`;
  } else {
    matchMessage = `The price of *${topProductName}* is **Rs. ${unitPrice}**.`;
  }
}

    return NextResponse.json({ 
      data: enrichedItems, 
      success: true, 
      is_stock_check: isStockQuery,
      quantity: quantity,
      total_price: enrichedItems[0]?.total_price || 0,
      message: matchMessage 
    });

  } catch (err: any) {
    console.error("Critical System Route Error:", err);
    return NextResponse.json({ error: "Internal Server Processing Error", details: err.message }, { status: 500 });
  }
}