import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Extract query parameters
    const category = searchParams.get('category');
    const product_type = searchParams.get('product_type');
    const q = searchParams.get('q');
    const color = searchParams.get('color');
    const price_query = searchParams.get('price_query') || searchParams.get('price'); 
    const user_id = searchParams.get('user_id'); 
    
    // Extract the dynamic phone number forwarded from the n8n webhook trigger
    const userPhone = searchParams.get('phone') || '';

    // Dynamic Header Check: Determine if this request is routing through WhatsApp / Meta Catalog
    const metaCatalogId = request.headers.get('x-catalog-id');
    const metaAccessToken = request.headers.get('x-access-token');

    // =========================================================================
    // BRANCH A: WHATSAPP META CATALOG SEARCH ENGINE (MULTI-PRODUCT READY)
    // =========================================================================
    if (metaCatalogId && metaAccessToken) {
      let queryText = (q || '').trim().toLowerCase();
      
      if (!queryText) {
        return NextResponse.json({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: userPhone,
          type: "text",
          text: { body: "What product can I help you find today?" }
        });
      }

      // Step A1: Unify and isolate price statements from query string
      let cleanQuery = queryText;
      let priceConditionStr = (price_query && price_query !== "null") ? price_query.trim().toLowerCase() : "null";

      if (priceConditionStr === "null") {
        if (cleanQuery.includes('under') || cleanQuery.includes('exact') || cleanQuery.includes('between')) {
          const priceMatch = cleanQuery.match(/(under\s+\d+|exact\s+\d+|between\s+\d+\s+to\s+\d+|between\s+\d+\s+and\s+\d+)/i);
          if (priceMatch) {
            priceConditionStr = priceMatch[0];
            cleanQuery = cleanQuery.replace(priceConditionStr, '').trim();
          }
        } else {
          const trailingNum = cleanQuery.match(/\b(\d+)\b$/);
          if (trailingNum && trailingNum[1]) {
            priceConditionStr = `under ${trailingNum[1]}`;
            cleanQuery = cleanQuery.replace(/\b\d+\b$/, '').trim();
          }
        }
      }

      // Parse numerical limits out for dynamic processing later
      let maxPriceFilter: number | null = null;
      let minPriceFilter: number | null = null;
      let exactPriceFilter: number | null = null;

      if (priceConditionStr !== "null") {
        if (priceConditionStr.startsWith('under')) {
          maxPriceFilter = parseFloat(priceConditionStr.replace('under', '').trim());
        } else if (priceConditionStr.startsWith('exact')) {
          exactPriceFilter = parseFloat(priceConditionStr.replace('exact', '').trim());
        } else if (priceConditionStr.startsWith('between')) {
          const parts = priceConditionStr.replace('between', '').split(/to|and/).map(n => parseFloat(n.trim()));
          if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            minPriceFilter = parts[0];
            maxPriceFilter = parts[1];
          }
        }
      }

      // Strip structural noise words and color tags
      const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow"];
      const genericWords = ["product", "products", "item", "items", "thing", "things", "all", "list"];
      
      let queryWords = cleanQuery.split(/\s+/).filter(word => word.length > 0);
      
      const explicitColorsFound = queryWords.filter(word => colorAdjectives.includes(word));
      let itemWords = queryWords.filter(word => !colorAdjectives.includes(word) && !genericWords.includes(word));

      itemWords = itemWords.map(word => {
        if (word === "shirts" || word === "tshirt" || word === "tshirts") return "t-shirt";
        if (word === "jeans" || word === "jean") return "jeans";
        if (word === "chairs") return "chair";
        if (word === "tables") return "table";
        if (word === "beds") return "bed";
        return word;
      });

      const finalSearchTerm = itemWords.join(" ") || cleanQuery;

      // Step A2: Try local database index lookup securely
      let matchedRetailerIds: string[] = [];
      
      if (user_id && user_id !== "null") {
        try {
          const supabase = await createSupabaseServerClient();
          let localQuery = supabase.from('products').select('retailer_id').eq('user_id', user_id);
          
          if (finalSearchTerm.length > 0) {
            localQuery = localQuery.or(`name.ilike.%${finalSearchTerm}%,description.ilike.%${finalSearchTerm}%,category.ilike.%${finalSearchTerm}%`);
          }

          if (explicitColorsFound.length > 0) {
            localQuery = localQuery.ilike('color', `%${explicitColorsFound[0]}%`);
          } else if (color && color !== "null") {
            localQuery = localQuery.ilike('color', `%${color.trim()}%`);
          }

          if (maxPriceFilter !== null && minPriceFilter !== null) {
            localQuery = localQuery.gte('price', minPriceFilter).lte('price', maxPriceFilter);
          } else if (maxPriceFilter !== null) {
            localQuery = localQuery.lte('price', maxPriceFilter);
          } else if (exactPriceFilter !== null) {
            localQuery = localQuery.eq('price', exactPriceFilter);
          }

          const { data: localProducts } = await localQuery;
          if (localProducts && localProducts.length > 0) {
            matchedRetailerIds = localProducts.map(p => p.retailer_id).filter(id => !!id);
          }
        } catch (dbErr) {
          console.error("Database bypass active:", dbErr);
        }
      }

      // Step A3: Compile filter conditions for Meta Catalog
let metaFilterObject: any = {};

if (matchedRetailerIds.length > 0) {
  const idConditions = matchedRetailerIds
    .slice(0, 20)
    .map(id => ({
      retailer_id: { i_contains: id }
    }));

  metaFilterObject = { or: idConditions };

} else {
  const wordsToSearch = [...itemWords, ...explicitColorsFound]
    .filter(w => !genericWords.includes(w));

  const textConditions = wordsToSearch.map(word => ({
    or: [
      { name: { contains: word } },
      { description: { contains: word } },
      { color: { contains: word } }
    ]
  }));

  metaFilterObject = { and: textConditions };
}

// Build Meta URL
const metaUrl =
  `https://graph.facebook.com/v20.0/${metaCatalogId}/products` +
  `?fields=id,name,retailer_id,price,image_url,color,description,url` +
  `&filter=${encodeURIComponent(JSON.stringify(metaFilterObject))}` +
  `&access_token=${metaAccessToken}`;

console.log("===== SEARCH API DEBUG =====");
console.log("Meta URL:", metaUrl);

const metaResponse = await fetch(metaUrl);

console.log("Status:", metaResponse.status);

const metaData = await metaResponse.json();

console.log("Response:");
console.log(JSON.stringify(metaData, null, 2));

if (!metaResponse.ok) {
  throw new Error(metaData.error?.message || "Meta Catalog API failure.");
}

let products = metaData.data || [];

      // Post-Processing validation filter for dynamic price filters
      if (products.length > 0 && (maxPriceFilter !== null || exactPriceFilter !== null || minPriceFilter !== null)) {
        products = products.filter((item: any) => {
          if (!item.price) return true;
          const cleanNumStr = item.price.replace(/[^0-9.]/g, '');
          const numericalPrice = parseFloat(cleanNumStr);
          
          if (isNaN(numericalPrice)) return true;
          if (exactPriceFilter !== null && numericalPrice !== exactPriceFilter) return false;
          if (maxPriceFilter !== null && numericalPrice > maxPriceFilter) return false;
          if (minPriceFilter !== null && numericalPrice < minPriceFilter) return false;
          
          return true;
        });
      }

      // Fallback text message if no catalog rows matched criteria
      if (products.length === 0) {
        // Check if a real price query was extracted (if it isn't "null")
        const hasBudget = priceConditionStr !== "null";

        return NextResponse.json({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: userPhone,
          type: "text",
          text: {
            body: `We couldn't find any items matching "${(q || '').trim()}"${hasBudget ? ' within that budget range' : ''} inside our catalog right now.`
          }
        });
      }

      // Dynamic array transformation grouping up to 30 items for WhatsApp multi-product payload sections
      const multiProductItemsArray = products.slice(0, 30).map((item: any) => ({
        product_retailer_id: item.retailer_id
      }));

      // Return a fully-compliant Native WhatsApp Interactive Multi-Product message schema object
      return NextResponse.json({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: userPhone,
        type: "interactive",
        interactive: {
          type: "multi_product",
          header: {
            type: "text",
            text: "Our Collection"
          },
          body: {
            text: `Here is what we found matching your request for "${(q || '').trim()}":`
          },
          footer: {
            text: "Tap view options below to see all items"
          },
          action: {
            catalog_id: metaCatalogId,
            sections: [
              {
                title: "Search Results",
                product_items: multiProductItemsArray
              }
            ]
          }
        },
        // Kept array format intact inside debug engine so JavaScript19 code nodes can preview every variant clearly
        debug_product_details: products.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          description: item.description,
          image_url: item.image_url,
          color: item.color,
          product_url: item.url || "https://woodpetra.in/"
        }))
      });
    }

    // =========================================================================
    // BRANCH B: STANDARD LOCAL WEBSITE SUPABASE SEARCH
    // =========================================================================
    if (!user_id) {
      return NextResponse.json({ error: "Missing tenant user_id authorization context." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    let query = supabase.from('products').select('*').eq('user_id', user_id); 

    if (category) query = query.ilike('category', `%${category.trim()}%`);
    if (product_type) query = query.ilike('product_type', `%${product_type.trim()}%`);
    if (color && color !== "") query = query.ilike('color', `%${color.trim()}%`);

    if (price_query && price_query !== "null" && price_query.trim() !== "") {
      const cleanPriceQuery = price_query.trim().toLowerCase();
      if (cleanPriceQuery.startsWith('under')) {
        const maxPrice = parseFloat(cleanPriceQuery.replace('under', '').trim());
        if (!isNaN(maxPrice)) query = query.lte('price', maxPrice);
      } 
      else if (cleanPriceQuery.startsWith('exact')) {
        const exactPrice = parseFloat(cleanPriceQuery.replace('exact', '').trim());
        if (!isNaN(exactPrice)) query = query.eq('price', exactPrice);
      } 
      else if (cleanPriceQuery.startsWith('between')) {
        const numericParts = cleanPriceQuery.replace('between', '').split('to').map(num => parseFloat(num.trim()));
        if (!isNaN(numericParts[0]) && !isNaN(numericParts[1])) {
          query = query.gte('price', numericParts[0]).lte('price', numericParts[1]);
        }
      }
    }

    let isGenericSearch = false; 

    if (q) {
      let cleanQuery = q.trim().toLowerCase();
      const genericWords = ["product", "products", "item", "items", "thing", "things", "all", "list"];
      
      if (genericWords.includes(cleanQuery)) {
        isGenericSearch = true;
      } else {
        const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow"];
        let queryWords = cleanQuery.split(/\s+/).filter(word => !colorAdjectives.includes(word));
        
        queryWords = queryWords.map(word => {
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

    let { data, error } = await query;

    if (error) {
      console.error("Supabase Query Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
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
          const numericParts = cleanPriceQuery.replace('between', '').split('to').map(num => parseFloat(num.trim()));
          if (!isNaN(numericParts[0]) && !isNaN(numericParts[1])) {
            altQuery = altQuery.gte('price', numericParts[0]).lte('price', numericParts[1]);
            hasPriceFilter = true;
            priceLabel = `between Rs. ${numericParts[0]} to Rs. ${numericParts[1]}`;
          }
        }
      }

      const { data: alternatives, error: altError } = await altQuery; 

      if (!altError && alternatives && alternatives.length > 0) {
        const searchItemName = q ? `"${q.trim()}"` : "that item";
        let responseMessage = "";

        if (q && !isGenericSearch) {
          responseMessage = `I'm sorry, we don't have ${searchItemName} ${priceLabel ? priceLabel : ''} in our store at the moment. However, you might love these options from our collection within that range:`;
        } else if (hasPriceFilter) {
          responseMessage = `Here are the options available in our collection ${priceLabel}:`;
        } else {
          responseMessage = `I'm sorry, we don't have ${searchItemName} in our store at the moment. However, you might love these popular pieces from our collection:`;
        }

        return NextResponse.json({ data: alternatives, success: true, message: responseMessage });
      }

      return NextResponse.json({ 
        data: [], 
        success: false, 
        message: q ? `We couldn't find any items matching "${q.trim()}" right now.` : "That item is currently unavailable." 
      });
    }

    let matchMessage = "Here is what we found:";
    if (isGenericSearch && price_query) {
      matchMessage = "Here are the options available in our collection matching your budget layout:";
    }

    return NextResponse.json({ data, success: true, message: matchMessage });

  } catch (err: any) {
    console.error("Global Route Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}