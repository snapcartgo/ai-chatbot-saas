import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabaseServer';

function getTermAliases(term: string) {
  const normalized = term.toLowerCase().trim();

  // T-Shirts
  if (
    normalized === "t-shirt" ||
    normalized === "t-shirts" ||
    normalized === "tshirt" ||
    normalized === "tshirts" ||
    normalized === "shirt" ||
    normalized === "shirts" ||
    normalized === "tee" ||
    normalized === "tees"
  ) {
    return ["t-shirt", "t-shirts", "tshirt", "tshirts", "shirt", "shirts", "tee", "tees"];
  }

  // Caps / Hats
  if (
    normalized === "cap" ||
    normalized === "caps" ||
    normalized === "hat" ||
    normalized === "hats"
  ) {
    return ["cap", "caps", "hat", "hats"];
  }

  // Earbuds / Headphones
  if (
    normalized === "earbud" ||
    normalized === "earbuds" ||
    normalized === "headphone" ||
    normalized === "headphones" ||
    normalized === "earphone" ||
    normalized === "earphones" ||
    normalized === "airpod" ||
    normalized === "airpods"
  ) {
    return ["earbud", "earbuds", "headphone", "headphones", "earphone", "earphones", "airpod", "airpods"];
  }

  // Jeans / Pants / Denim
  if (
    normalized === "jeans" ||
    normalized === "jean" ||
    normalized === "denim" ||
    normalized === "pant" ||
    normalized === "pants" ||
    normalized === "trouser" ||
    normalized === "trousers"
  ) {
    return ["jeans", "jean", "denim", "pant", "pants", "trouser", "trousers"];
  }

  // Electronics
  if (normalized === "electronics" || normalized === "electronic") {
    return ["electronics", "electronic", "earbud", "earbuds", "headphone", "headphones", "watch", "watches"];
  }

  // ADD THIS BLOCK: Clothing / Apparel
  if (
    normalized === "clothing" ||
    normalized === "clothes" ||
    normalized === "apparel" ||
    normalized === "wear" ||
    normalized === "wearables"
  ) {
    return ["clothing", "clothes", "apparel", "t-shirt", "tshirts", "tshirt", "shirt", "shirts", "jeans", "jean", "pant", "pants", "denim"];
  }

  // Chairs
  if (normalized === "chair" || normalized === "chairs") {
    return ["chair", "chairs"];
  }

  // Tables
  if (normalized === "table" || normalized === "tables") {
    return ["table", "tables"];
  }

  // Beds
  if (normalized === "bed" || normalized === "beds") {
    return ["bed", "beds"];
  }

  return [normalized];
}

function detectColorForTerm(cleanQuery: string, explicitColorsFound: string[], term: string) {
  const aliases = getTermAliases(term).map(escapeRegExp);

  for (const color of explicitColorsFound) {
    const safeColor = escapeRegExp(color);

    const colorBeforeRegex = new RegExp(
      `\\b${safeColor}\\s+(${aliases.join("|")})\\b`,
      "i"
    );

    const colorAfterRegex = new RegExp(
      `\\b(${aliases.join("|")})\\s+${safeColor}\\b`,
      "i"
    );

    if (colorBeforeRegex.test(cleanQuery) || colorAfterRegex.test(cleanQuery)) {
      return color;
    }
  }

  return undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesSearchTerm(item: any, term: string) {
  const cleanTerm = term.toLowerCase().trim();
  const name = String(item?.name || '').toLowerCase();
  const desc = String(item?.description || '').toLowerCase();
  const cat = String(item?.category || '').toLowerCase();
  const color = String(item?.color || '').toLowerCase();

  const aliases = getTermAliases(cleanTerm);

  return aliases.some(alias => 
    name.includes(alias) || 
    desc.includes(alias) || 
    cat.includes(alias) || 
    color.includes(alias)
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Extract query parameters
    const category = searchParams.get('category');
    const product_type = searchParams.get('product_type');
    const rawQ = searchParams.get('q');
    let parsedQueries: string[] = [];

    if (rawQ) {
      try {
        const parsed = JSON.parse(rawQ);
        if (Array.isArray(parsed)) {
          parsedQueries = parsed.map((s: any) => String(s));
        } else {
          parsedQueries = [String(rawQ)];
        }
      } catch {
        parsedQueries = [String(rawQ)];
      }
    }

    // Preserve 'q' as a clean string for logging/messaging
    const q = parsedQueries.length > 0 ? parsedQueries.join(', ') : (rawQ || '');
    const color = searchParams.get('color');
    const price_query = searchParams.get('price_query') || searchParams.get('price'); 
    const user_id = searchParams.get('user_id'); 
    
    // Extract the dynamic phone number forwarded from the n8n webhook trigger
    const userPhone = searchParams.get('phone') || '';

    // Dynamic Header Check: Determine if this request is routing through WhatsApp / Meta Catalog
    const metaCatalogId = request.headers.get('x-catalog-id');
    const metaAccessToken = request.headers.get('x-access-token');

    // Replace lines 148-151 with this updated array:
const genericWords = [
  // Generic placeholders
  "something", "anything", "stuff", "thing", "things", "item", "items", 
  "product", "products", "produt", "produts",

  // Catalog & Collection terms
  "all", "list", "any", "catalog", "collection", "options", "inventory", 
  "stock", "store", "shop", "categories", "variety", "everything",

  // Conversational / Broad Phrases
  "any product", "available products", "available product", "show me", 
  "what do you have", "what's available", "whats available", "show catalog",
  "home essentials"
];

    // =========================================================================
    // BRANCH A: WHATSAPP META CATALOG SEARCH ENGINE (MULTI-PRODUCT READY)
    // =========================================================================
    if (metaCatalogId && metaAccessToken) {
      // Join all extracted queries cleanly into a standard space-separated string
      let queryText = (parsedQueries.length > 0 ? parsedQueries.join(' ') : (q || '')).trim().toLowerCase();

      console.log("Incoming q:", q);
      console.log("Query Text:", queryText);
      
      // Check for dedicated stock query parameters
      const isStockQueryParam = 
        searchParams.get('is_stock_query') === 'true' || 
        searchParams.get('stock_check') === 'true' || 
        searchParams.get('availability') === 'true';

      // Keyword fallback check inside search text string
      const stockKeywords = ["stock", "available", "availability", "in stock", "have", "present", "left", "do you have", "is there", "are there"];
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
        queryText.includes("home essentials");

      // Step A1: Unify and isolate price statements safely
      let cleanQuery = queryText;
      let rawPrice = (price_query && price_query !== "null" && price_query !== "value") ? price_query.trim().toLowerCase() : "null";

      // Ensure rawPrice actually contains price-related keywords or numbers, otherwise reset to "null"
      if (rawPrice !== "null" && !/(under|exact|between|\d+)/i.test(rawPrice)) {
        rawPrice = "null";
      }

      let priceConditionStr = rawPrice;

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

      let cleanQueryWithoutCommas = cleanQuery.replace(/,/g, ' ');
      let queryWords = cleanQueryWithoutCommas.split(/\s+/).filter((word: string) => word.length > 0);

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
        if (word === "clothing" || word === "clothes" || word === "apparel") return "clothing"; // ADD THIS LINE
        if (word === "chairs") return "chair";
        if (word === "tables") return "table";
        if (word === "beds") return "bed";
        if (word === "electronic" || word === "electronics") return "electronics";
        return word;
      });

      // Split into unique individual product terms (e.g., ["jeans", "t-shirt"])
      const individualProductTerms = Array.from(new Set(itemWords));
      const finalSearchTerm = individualProductTerms.join(" ") || cleanQuery;

      // 🚨 BUILD SEARCH PAIRS EARLY SO IT IS ACCESSIBLE THROUGHOUT THE FUNCTION
      const searchPairs: { term: string; color?: string }[] = individualProductTerms.map((term) => {
        const matchedColor = detectColorForTerm(cleanQuery, explicitColorsFound, term);
        return { term, color: matchedColor };
      });

      // Step A2: Try local database index lookup securely using alias expansions
      let matchedRetailerIds: string[] = [];
      
      if (user_id && user_id !== "null") {
        try {
          const supabase = await createSupabaseServerClient();
          let localQuery = supabase.from('products').select('retailer_id,name,description,category,product_type').eq('user_id', user_id);

          if (individualProductTerms.length > 0 && !isMetaGenericSearch) {
            const searchConditions: string[] = [];

            individualProductTerms.forEach(term => {
              const aliases = getTermAliases(term);
              aliases.forEach(alias => {
                searchConditions.push(`name.ilike.%${alias}%`);
                searchConditions.push(`description.ilike.%${alias}%`);
                searchConditions.push(`category.ilike.%${alias}%`);
                searchConditions.push(`product_type.ilike.%${alias}%`);
              });
            });

            if (searchConditions.length > 0) {
              localQuery = localQuery.or(searchConditions.join(","));
            }
          }

          if ((!explicitColorsFound || explicitColorsFound.length === 0) && color && color !== "null") {
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

      if (!isMetaGenericSearch && individualProductTerms.length > 0) {
        if (matchedRetailerIds.length > 0) {
          products = rawCatalogProducts.filter((product: any) =>
            matchedRetailerIds.includes(product.retailer_id)
          );
        } else {
          products = [];
        }
      }

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

      // Target-aware color matching
      // Target-aware color matching (FIXED: Don't eliminate terms that don't match strict color)
      if (products.length > 0 && !isMetaGenericSearch && explicitColorsFound.length > 0) {
        const strictColorMatch = products.filter((item: any) => {
          const name = (item.name || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const pColor = (item.color || '').toLowerCase();

          return searchPairs.some((pair) => {
            const aliases = getTermAliases(pair.term);
            const matchesTerm = aliases.some(alias => name.includes(alias) || desc.includes(alias));
            
            if (!matchesTerm) return false;
            
            if (pair.color) {
              return pColor.includes(pair.color) || name.includes(pair.color) || desc.includes(pair.color);
            }
            return true;
          });
        });

        // Only override products if we actually found color matches without discarding other searched items
        if (strictColorMatch.length > 0) {
          products = products.filter(p => {
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const pColor = (p.color || '').toLowerCase();

            // Find matching pair for this product
            const pair = searchPairs.find(sp => {
              const aliases = getTermAliases(sp.term);
              return aliases.some(alias => name.includes(alias) || desc.includes(alias));
            });

            // If a color was specified for this product term, enforce it
            if (pair && pair.color) {
              return pColor.includes(pair.color) || name.includes(pair.color) || desc.includes(pair.color);
            }
            return true;
          });
        }
      }

      // STRICT FALLBACK
      if (products.length === 0 || (!isMetaGenericSearch && explicitColorsFound.length > 0 && !products.some(p => explicitColorsFound.some(c => (p.color || '').toLowerCase().includes(c))))) {
        const fallbackUrl = `https://graph.facebook.com/v20.0/${metaCatalogId}/products?fields=id,name,retailer_id,price,image_url,color,description,url,category,availability&access_token=${metaAccessToken}`;
        const fallbackResponse = await fetch(fallbackUrl);
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackResponse.ok && fallbackData.data) {
          const allCatalogProducts = fallbackData.data;

          if (isMetaGenericSearch) {
            products = allCatalogProducts;
          } else if (matchedRetailerIds.length > 0) {
            products = allCatalogProducts.filter((item: any) =>
              matchedRetailerIds.includes(item.retailer_id)
            );
          } else {
            products = [];
          }
        }
      }

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
      // DEDICATED STOCK QUERY OVERRIDE
      // =========================================================================
      if (isStockQuery) {
        const inStockItems: any[] = [];
        const missingItems: string[] = [];

        for (const pair of searchPairs) {
  const formattedTerm = pair.term.charAt(0).toUpperCase() + pair.term.slice(1);
  const pairLabel = pair.color 
    ? `${pair.color.charAt(0).toUpperCase() + pair.color.slice(1)} ${formattedTerm}`
    : formattedTerm;

  const termAliases = getTermAliases(pair.term);

  // 1. Check for ALL matching items (term + requested color)
  const matchedProducts = products.filter((p: any) => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const pColor = (p.color || '').toLowerCase();
    const isAvail = p.availability === 'in stock' || p.availability === 'in_stock';

    const matchesTerm = termAliases.some(alias => 
      name.includes(alias) || desc.includes(alias) || cat.includes(alias)
    );

    const matchesColor = !pair.color || pColor.includes(pair.color) || name.includes(pair.color);

    return matchesTerm && matchesColor && isAvail;
  });

  // 2. Category Fallback: Find ALL items in ANY color if specific color is out of stock
  const categoryFallbackProducts = matchedProducts.length === 0 ? rawCatalogProducts.filter((p: any) => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    const isAvail = p.availability === 'in stock' || p.availability === 'in_stock';

    return termAliases.some(alias => name.includes(alias) || desc.includes(alias) || cat.includes(alias)) && isAvail;
  }) : [];

  if (matchedProducts.length > 0) {
    inStockItems.push(...matchedProducts);
  } else if (categoryFallbackProducts.length > 0) {
    inStockItems.push(...categoryFallbackProducts);
    if (pair.color) {
      missingItems.push(pairLabel);
    }
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
      const priceQueryParam = (price_query && price_query !== "null") ? price_query.trim().toLowerCase() : "";
      const combinedPriceText = `${cleanQuery} ${priceQueryParam}`;

      const isLowestPriceQuery = /\b(lowest|cheapest|min|least\s+expensive)\b/i.test(combinedPriceText);
      const isHighestPriceQuery = /\b(highest|most\s+expensive|max|pricier|top\s+end)\b/i.test(combinedPriceText);

      if (products.length > 0 && (isLowestPriceQuery || isHighestPriceQuery)) {
        products.sort((a: any, b: any) => {
          const priceA = parseFloat(String(a.price || '0').replace(/[^0-9.]/g, '')) || 0;
          const priceB = parseFloat(String(b.price || '0').replace(/[^0-9.]/g, '')) || 0;

          return isLowestPriceQuery ? priceA - priceB : priceB - priceA;
        });

        const targetPrice = parseFloat(String(products[0].price || '0').replace(/[^0-9.]/g, ''));
        products = products.filter((p: any) => {
          const itemPrice = parseFloat(String(p.price || '0').replace(/[^0-9.]/g, ''));
          return itemPrice === targetPrice;
        });
      }
      
      let processedProducts: any[] = products.slice(0, 30);

      const multiProductItemsArray = processedProducts.map((item: any) => ({
        product_retailer_id: item.retailer_id
      }));

      let priceFilteredOutPairs: { pairLabel: string; actualPrice?: string }[] = [];
      let trulyMissingPairs: string[] = [];

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

          const termAliases = getTermAliases(pair.term);
          let matchesTerm = termAliases.some(alias => 
            name.includes(alias) || desc.includes(alias) || cat.includes(alias)
          );

          const matchesColor = !pair.color || pColor.includes(pair.color) || name.includes(pair.color);

          return matchesTerm && matchesColor;
        };

        let unconstrainedProducts: any[] = rawCatalogProducts;

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
          explanations.push(`Sorry, ${trulyMissingPairs.join(', ')} is currently out of stock`);
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
      let cleanQuery = (parsedQueries.length > 0 ? parsedQueries.join(' ') : q).trim().toLowerCase();
      
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