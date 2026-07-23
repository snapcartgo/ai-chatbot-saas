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

    // Generic word list to capture broad catalog requests
    const genericWords = [
      "product", "products", "item", "items", "thing", "things", 
      "all", "list", "any", "any product", "available products", "available product", "catalog"
    ];

    // =========================================================================
    // BRANCH A: WHATSAPP META CATALOG SEARCH ENGINE (MULTI-PRODUCT READY)
    // =========================================================================
    if (metaCatalogId && metaAccessToken) {
      let queryText = (q || '').trim().toLowerCase();
      
      // 1. Check for dedicated stock query parameters
      const isStockQueryParam = 
        searchParams.get('is_stock_query') === 'true' || 
        searchParams.get('stock_check') === 'true' || 
        searchParams.get('availability') === 'true';

      // 2. Keyword fallback check inside search text string
      const stockKeywords = ["stock", "available", "availability", "in stock", "have", "present", "left"];
      const isStockQuery = isStockQueryParam || stockKeywords.some((keyword) => queryText.includes(keyword));

      if (!queryText) {
        return NextResponse.json({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: userPhone,
          type: "text",
          text: { body: "What product can I help you find today?" }
        });
      }

      // Broad expression matching for incoming n8n/conversational text strings
      const isMetaGenericSearch = 
        genericWords.includes(queryText) || 
        queryText.includes("any product") || 
        queryText.includes("available products") || 
        queryText.includes("show me") || 
        queryText.includes(",") || 
        queryText.includes("home essentials");

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
          const parts = priceConditionStr.replace('between', '').split(/to|and/).map((n: string) => parseFloat(n.trim()));
          if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            minPriceFilter = parts[0];
            maxPriceFilter = parts[1];
          }
        }
      }

      // Strip fluff words, stop words, stock keywords, color tags, and typos
      const stopWords = ["show", "me", "find", "get", "look", "for", "i", "want", "need", "please", "and", "or", "with"];
      const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow", "olive"];
      const categoryNoiseWords = ["product", "products", "produt", "produts", "item", "items", "thing", "things"];
      
      let queryWords = cleanQuery.split(/\s+/).filter((word: string) => word.length > 0);
      const explicitColorsFound = queryWords.filter((word: string) => colorAdjectives.includes(word));
      
      let itemWords = queryWords.filter((word: string) => 
        !colorAdjectives.includes(word) && 
        !genericWords.includes(word) && 
        !stockKeywords.includes(word) &&
        !stopWords.includes(word) &&
        !categoryNoiseWords.includes(word)
      );

      // Synonym & Variation Normalization
      itemWords = itemWords.map((word: string) => {
        if (word === "shirts" || word === "tshirt" || word === "tshirts" || word === "tee" || word === "tees") return "t-shirt";
        if (word === "jeans" || word === "jean" || word === "denim") return "jeans";
        if (word === "chairs") return "chair";
        if (word === "tables") return "table";
        if (word === "beds") return "bed";
        if (word === "electronic" || word === "electronics") return "electronics";
        return word;
      });

      // Split into unique individual product terms (e.g., ["jeans", "t-shirt"])
      const individualProductTerms = Array.from(new Set(itemWords));
      const finalSearchTerm = individualProductTerms.join(" ") || cleanQuery;

      // Step A2: Try local database index lookup securely
      let matchedRetailerIds: string[] = [];
      
      if (user_id && user_id !== "null") {
        try {
          const supabase = await createSupabaseServerClient();
          let localQuery = supabase.from('products').select('retailer_id').eq('user_id', user_id);
          
          if (individualProductTerms.length > 0 && !isMetaGenericSearch) {
            const orConditions = individualProductTerms.map(
              term => `name.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`
            ).join(',');
            
            localQuery = localQuery.or(orConditions);
          }

          if (explicitColorsFound.length > 0) {
            const colorConditions = explicitColorsFound.map(
              c => `color.ilike.%${c}%,name.ilike.%${c}%,description.ilike.%${c}%`
            ).join(',');
            
            localQuery = localQuery.or(colorConditions);
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
            matchedRetailerIds = localProducts.map((p: any) => p.retailer_id).filter((id: string) => !!id);
          }
        } catch (dbErr) {
          console.error("Database bypass active:", dbErr);
        }
      }

      // Step A3: Compile filter conditions for Meta Catalog
      let metaFilterObject: any = {};
      let usingTextSearchFallback = false;

      if (isMetaGenericSearch) {
        metaFilterObject = {}; 
      } else if (matchedRetailerIds.length > 0) {
        const idConditions = matchedRetailerIds
          .slice(0, 20)
          .map((id: string) => ({
            retailer_id: { i_contains: id }
          }));

        metaFilterObject = { or: idConditions };
      } else {
        usingTextSearchFallback = true;
      }

      // Build Meta URL with availability field included
      let metaUrl =
        `https://graph.facebook.com/v20.0/${metaCatalogId}/products` +
        `?fields=id,name,retailer_id,price,image_url,color,description,url,category,availability` +
        `&access_token=${metaAccessToken}`;

      if (Object.keys(metaFilterObject).length > 0) {
        metaUrl += `&filter=${encodeURIComponent(JSON.stringify(metaFilterObject))}`;
      } else if (usingTextSearchFallback && finalSearchTerm) {
        metaUrl += `&q=${encodeURIComponent(finalSearchTerm)}`;
      }

      let metaResponse = await fetch(metaUrl);
      let metaData = await metaResponse.json();

      if (!metaResponse.ok) {
        throw new Error(metaData.error?.message || "Meta Catalog API failure.");
      }

      let rawCatalogProducts = metaData.data || [];
      let products = [...rawCatalogProducts];

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

      // Filter by requested color AND product term if specific search was made
      if (products.length > 0 && !isMetaGenericSearch && explicitColorsFound.length > 0) {
        const strictColorMatch = products.filter((item: any) => {
          const name = (item.name || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const pColor = (item.color || '').toLowerCase();

          return explicitColorsFound.some(c => pColor.includes(c) || name.includes(c) || desc.includes(c));
        });

        // If the specific requested color exists, use strictly colored products
        if (strictColorMatch.length > 0) {
          products = strictColorMatch;
        }
      }

      // STRICT FALLBACK: If requested color/item combo returned 0 results, match ONLY requested product terms (e.g. Jeans only)
      if (products.length === 0 || (!isMetaGenericSearch && explicitColorsFound.length > 0 && !products.some(p => explicitColorsFound.some(c => (p.color || '').toLowerCase().includes(c))))) {
        const fallbackUrl = `https://graph.facebook.com/v20.0/${metaCatalogId}/products?fields=id,name,retailer_id,price,image_url,color,description,url,category,availability&access_token=${metaAccessToken}`;
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackResponse.ok && fallbackData.data) {
          const allCatalogProducts = fallbackData.data;

          if (isMetaGenericSearch) {
            products = allCatalogProducts;
          } else if (individualProductTerms.length > 0) {
            // STRICTLY filter ONLY items matching the product type (e.g., ONLY Jeans)
            products = allCatalogProducts.filter((item: any) => {
              const name = (item.name || '').toLowerCase();
              const desc = (item.description || '').toLowerCase();
              const cat = (item.category || '').toLowerCase();

              return individualProductTerms.some((term: string) => {
                const cleanTerm = term.toLowerCase();
                if (cleanTerm === "jeans") {
                  return name.includes("jean") || name.includes("pant") || desc.includes("denim") || cat.includes("jeans") || cat.includes("clothing");
                }
                if (cleanTerm === "t-shirt") {
                  return name.includes("shirt") || name.includes("tee") || desc.includes("cotton") || cat.includes("t-shirt");
                }
                if (cleanTerm === "electronics") {
                  return name.includes("earbud") || name.includes("headphone") || cat.includes("electronic");
                }
                return name.includes(cleanTerm) || desc.includes(cleanTerm) || cat.includes(cleanTerm);
              });
            });
          }
        }
      }

      // If STILL no relevant category products exist, return a clean text response
      if (products.length === 0) {
        return NextResponse.json({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: userPhone,
          type: "text",
          text: {
            body: `Sorry, we don't have "${(q || '').trim()}" in stock right now, and no similar items were found in our store.`
          }
        });
      }

      // =========================================================================
      // DEDICATED STOCK QUERY OVERRIDE (WITH MISSING ITEMS DETECTOR)
      // =========================================================================
      if (isStockQuery) {
        // 1. Build requirement pairs from query
        const searchPairs = individualProductTerms.map(term => {
          const matchedColor = explicitColorsFound.find(color => {
            const regex = new RegExp(`${color}\\s+(${term}|${term.replace('-', '')}|shirt|jeans|pant|chair|table)`, 'i');
            return regex.test(cleanQuery);
          });
          return { term, color: matchedColor };
        });

        const inStockItems: any[] = [];
        const missingItems: string[] = [];

        for (const pair of searchPairs) {
          const formattedTerm = pair.term.charAt(0).toUpperCase() + pair.term.slice(1);
          const pairLabel = pair.color 
            ? `${pair.color.charAt(0).toUpperCase() + pair.color.slice(1)} ${formattedTerm}`
            : formattedTerm;

          const matchedProduct = products.find((p: any) => {
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const cat = (p.category || '').toLowerCase();
            const pColor = (p.color || '').toLowerCase();
            const isAvail = p.availability === 'in stock' || p.availability === 'in_stock';

            let matchesTerm = name.includes(pair.term) || desc.includes(pair.term) || cat.includes(pair.term);
            if (pair.term === "t-shirt") {
              matchesTerm = matchesTerm || name.includes("shirt") || desc.includes("shirt");
            }

            const matchesColor = !pair.color || pColor.includes(pair.color) || name.includes(pair.color);

            return matchesTerm && matchesColor && isAvail;
          });

          if (matchedProduct) {
            inStockItems.push(matchedProduct);
          } else {
            missingItems.push(pairLabel);
          }
        }

        let stockText = "";

        if (missingItems.length > 0) {
          stockText += `❌ *${missingItems.join(', ')}* is currently out of stock.`;
        }

        if (inStockItems.length > 0) {
          const formattedInStock = inStockItems.map((item: any) => {
            const attrs = [];
            if (item.color) attrs.push(item.color);
            if (item.size) attrs.push(item.size);
            const attrString = attrs.length > 0 ? ` (${attrs.join(', ')})` : '';
            return `• *${item.name}*${attrString}`;
          });

          const uniqueItemList = Array.from(new Set(formattedInStock)).join('\n');
          
          if (stockText.length > 0) {
            stockText += `\n\n✅ However, we have these available options in stock:\n\n${uniqueItemList}`;
          } else {
            stockText = `✅ The following items are available in stock:\n\n${uniqueItemList}`;
          }
        } else if (missingItems.length === 0) {
          stockText = `❌ Sorry, the requested items are currently out of stock.`;
        }

        return NextResponse.json({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: userPhone,
          type: "text",
          text: {
            body: stockText
          }
        });
      }

      // =========================================================================
      // STANDARD PRODUCT SEARCH (RETURNS INTERACTIVE CATALOG CARD)
      // =========================================================================
      let processedProducts: any[] = products.slice(0, 30);

      const multiProductItemsArray = processedProducts.map((item: any) => ({
        product_retailer_id: item.retailer_id
      }));

      // Build requirement pairs for standard search evaluation
      const searchPairs: { term: string; color?: string }[] = individualProductTerms.map(term => {
        const matchedColor = explicitColorsFound.find(color => {
          const regex = new RegExp(`${color}\\s+(${term}|${term.replace('-', '')}|shirt|jeans|pant|chair|table)`, 'i');
          return regex.test(cleanQuery);
        });

        return { term, color: matchedColor };
      });

      // Prepare unconstrained products set (ignoring price filters)
      let unconstrainedProducts: any[] = rawCatalogProducts;

      if (maxPriceFilter !== null || minPriceFilter !== null || exactPriceFilter !== null) {
        try {
          const unconstrainedTerm = individualProductTerms.join(" ");
          const unconstrainedUrl = `https://graph.facebook.com/v20.0/${metaCatalogId}/products?fields=id,name,retailer_id,price,image_url,color,description,url,category,availability&q=${encodeURIComponent(unconstrainedTerm)}&access_token=${metaAccessToken}`;
          
          const fullRes = await fetch(unconstrainedUrl);
          const fullData = await fullRes.json();
          
          if (fullRes.ok && fullData.data && fullData.data.length > 0) {
            unconstrainedProducts = fullData.data;
          } else {
            const fullCatalogUrl = `https://graph.facebook.com/v20.0/${metaCatalogId}/products?fields=id,name,retailer_id,price,image_url,color,description,url,category,availability&access_token=${metaAccessToken}`;
            const fallbackRes = await fetch(fullCatalogUrl);
            const fallbackData = await fallbackRes.json();
            if (fallbackRes.ok && fallbackData.data) {
              unconstrainedProducts = fallbackData.data;
            }
          }
        } catch (e) {
          console.error("Unconstrained fetch error:", e);
        }
      }

      let priceFilteredOutPairs: { pairLabel: string; actualPrice?: string }[] = [];
      let trulyMissingPairs: string[] = [];

      const isClothingTerm = (term: string) => ["clothing", "clothes", "apparel", "wear"].includes(term.toLowerCase());
      const isElectronicsTerm = (term: string) => ["electronics", "electronic", "gadget", "gadgets", "tech"].includes(term.toLowerCase());

      for (const pair of searchPairs) {
        const formattedTerm = pair.term.charAt(0).toUpperCase() + pair.term.slice(1);
        const pairLabel = pair.color 
          ? `${pair.color.charAt(0).toUpperCase() + pair.color.slice(1)} ${formattedTerm}`
          : formattedTerm;

        const matchesProduct = (p: any) => {
          const name = (p.name || '').toLowerCase();
          const desc = (p.description || '').toLowerCase();
          const cat = (p.category || '').toLowerCase();
          const pColor = (p.color || '').toLowerCase();

          let matchesTerm = name.includes(pair.term) || desc.includes(pair.term) || cat.includes(pair.term);
          
          if (isClothingTerm(pair.term)) {
            matchesTerm = matchesTerm || cat.includes("clothing") || name.includes("shirt") || name.includes("jean") || name.includes("pant") || desc.includes("denim");
          } else if (isElectronicsTerm(pair.term)) {
            matchesTerm = matchesTerm || cat.includes("electronic") || name.includes("earbud") || name.includes("headphone") || name.includes("watch") || desc.includes("electronic") || desc.includes("bluetooth");
          } else if (pair.term === "t-shirt") {
            matchesTerm = matchesTerm || name.includes("shirt") || desc.includes("shirt");
          }

          const matchesColor = !pair.color || pColor.includes(pair.color) || name.includes(pair.color);

          return matchesTerm && matchesColor;
        };

        const itemInCatalog = unconstrainedProducts.find(matchesProduct);
        const existsUnderPrice = products.some(matchesProduct);

        if (!itemInCatalog) {
          trulyMissingPairs.push(pairLabel);
        } else if (!existsUnderPrice) {
          priceFilteredOutPairs.push({
            pairLabel,
            actualPrice: itemInCatalog.price || ''
          });
        }
      }

      let bodyText = "";

      if (isMetaGenericSearch) {
        bodyText = "Here are the top categories currently available in our store:";
      } else if (trulyMissingPairs.length === 0 && priceFilteredOutPairs.length === 0) {
        bodyText = `Here is what we found matching your request for "${(q || '').trim()}":`;
      } else {
        const explanations: string[] = [];

        if (trulyMissingPairs.length > 0) {
          explanations.push(`We don't have ${trulyMissingPairs.join(', ')} in stock`);
        }

        if (priceFilteredOutPairs.length > 0) {
          const budgetLabel = priceConditionStr !== "null" ? priceConditionStr : `under ₹${maxPriceFilter}`;
          const priceItemsStr = priceFilteredOutPairs.map(p => 
            p.actualPrice ? `${p.pairLabel} (${p.actualPrice})` : p.pairLabel
          ).join(', ');

          explanations.push(`${priceItemsStr} is not available ${budgetLabel}`);
        }

        bodyText = `${explanations.join(', and ')}. Here are the available options in our collection:`;
      }

      const footerText = "Tap view options below to see all items";

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
            text: bodyText
          },
          footer: {
            text: footerText
          },
          action: {
            catalog_id: metaCatalogId,
            sections: [
              {
                title: isMetaGenericSearch ? "Explore Categories" : "Search Results",
                product_items: multiProductItemsArray
              }
            ]
          }
        },
        debug_product_details: processedProducts.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          availability: item.availability,
          description: item.description,
          image_url: item.image_url,
          color: item.color,
          product_url: item.url 
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
        const numericParts = cleanPriceQuery.replace('between', '').split('to').map((num: string) => parseFloat(num.trim()));
        if (!isNaN(numericParts[0]) && !isNaN(numericParts[1])) {
          query = query.gte('price', numericParts[0]).lte('price', numericParts[1]);
        }
      }
    }

    let isGenericSearch = false; 

    if (q) {
      let cleanQuery = q.trim().toLowerCase();
      
      if (
        genericWords.includes(cleanQuery) || 
        cleanQuery.includes("any product") || 
        cleanQuery.includes("available products") || 
        cleanQuery.includes("show me") ||
        cleanQuery.includes(",") ||
        cleanQuery.includes("home essentials")
      ) {
        isGenericSearch = true;
      } else {
        const stopWords = ["show", "me", "find", "get", "look", "for", "i", "want", "need", "please"];
        const colorAdjectives = ["white", "black", "blue", "red", "green", "grey", "gray", "yellow", "olive"];
        let queryWords = cleanQuery.split(/\s+/).filter((word: string) => !colorAdjectives.includes(word) && !stopWords.includes(word));
        
        queryWords = queryWords.map((word: string) => {
          if (word === "shirts" || word === "tshirt" || word === "tshirts" || word === "tee" || word === "tees") return "t-shirt";
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

      const { data: alternatives, error: altError } = await altQuery; 

      if (!altError && alternatives && alternatives.length > 0) {
        const searchItemName = q ? `"${q.trim()}"` : "that item";
        let responseMessage = "";

        if (q && !isGenericSearch) {
          responseMessage = `I'm sorry, we don't have ${searchItemName} ${priceLabel ? priceLabel : ''} in our store at the moment. However, you might love these options from our collection within that range:`;
        } else if (hasPriceFilter) {
          responseMessage = `Here are the options available in our collection ${priceLabel}:`;
        } else {
          responseMessage = `Here are some popular pieces from our collection:`;
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