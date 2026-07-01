import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== VALIDATE ORDER API V8 PRODUCTION =====");
  try {
    const body = await req.json();
    const sessionId = body.session_id;
    const items = body.items;
    const user_id = body.user_id; 

    if (!user_id) {
      return NextResponse.json({ success: false, message: "Missing user_id context." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;

    const missingProducts: any[] = [];

    // Loop through ALL items submitted concurrently
    for (const item of items) {
      const { product_name, quantity, selected_attributes = {} } = item;
      const mergedAttributes = selected_attributes || {};
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      // Clean the incoming search text
      let search = product_name.trim().toLowerCase();

      // 💡 GLOBAL NORMALIZATION LAYER: Intercept variation strings immediately
      if (search === "tshirt" || search === "t shirt" || search === "shirt") {
        search = "t-shirt";
      }

      // 1. Primary Fuzzy Search (Strictly scoped to user_id using isolated logical grouping)
      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id) 
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      // 2. Fallback Split-Phrase Search (If first lookup came up completely empty)
      if ((!products || products.length === 0) && search.includes(" ")) {
        const words = search.split(" ").filter(Boolean);
        let genericTerm = words[words.length - 1]; 
        
        if (genericTerm === "tshirt" || genericTerm === "shirt") {
          genericTerm = "t-shirt";
        }
        
        const { data: fallbackProducts } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user_id) 
          .or(`name.ilike.%${genericTerm}%,category.ilike.%${genericTerm}%`);
          
        if (fallbackProducts && fallbackProducts.length > 0) {
          products = fallbackProducts;
          if (search.includes("white") && !mergedAttributes.color) {
            mergedAttributes.color = "White";
          }
        }
      }

      // If item still completely missing from database catalog, track it and continue
      if (productError || !products || products.length === 0) {
        missingProducts.push({
          product_name: product_name,
          error_type: "not_found"
        });
        continue; 
      }

      let product = null;
      let variantMatched = false;

      // ⚡ EXACT VARIANT MATCHING LOOKUP LAYER
      if (Object.keys(mergedAttributes).length > 0) {
        const matchedProduct = products.find((p: any) => {
          return Object.entries(mergedAttributes).every(([key, value]) => {
            const dbValue = p.attributes?.[key];
            if (Array.isArray(dbValue)) {
              return dbValue.map(v => String(v).toLowerCase().trim()).includes(String(value).toLowerCase().trim());
            }
            return String(dbValue || "").toLowerCase().trim() === String(value).toLowerCase().trim();
          });
        });

        if (matchedProduct) {
          product = matchedProduct;
          variantMatched = true;
        }
      }

      // ⚡ FIX: Strong data grouping check to ensure keys never get mixed up
      if (!variantMatched && Object.keys(mergedAttributes).length > 0) {
        const totalAvailableOptions: Record<string, string[]> = { color: [], size: [] };
        
        products.forEach((p: any) => {
          if (p.attributes) {
            Object.entries(p.attributes).forEach(([key, val]) => {
              const strVal = String(val).trim();
              if (!strVal || strVal.toLowerCase() === "null") return;

              // Detect if a value is actually a size but stored under a different attribute key
              const isSizeValue = /^(m|l|xl|s|xs|30|32|34|36|38|40|42)$/i.test(strVal);
              // Detect if a value is actually a color description
              const isColorValue = /^(black|white|blue|red|green|yellow|pink|grey|cream|beige|maroon|navy)$/i.test(strVal);

              if (isSizeValue) {
                if (!totalAvailableOptions.size.includes(strVal)) {
                  totalAvailableOptions.size.push(strVal);
                }
              } else if (isColorValue) {
                if (!totalAvailableOptions.color.includes(strVal)) {
                  totalAvailableOptions.color.push(strVal);
                }
              } else {
                // Fallback to original key positioning if it doesn't match standard color/size rules
                if (!totalAvailableOptions[key]) totalAvailableOptions[key] = [];
                if (!totalAvailableOptions[key].includes(strVal)) {
                  totalAvailableOptions[key].push(strVal);
                }
              }
            });
          }
        });

        missingProducts.push({
          product_name: products[0].name,
          error_type: "invalid_variant",
          requested_attributes: mergedAttributes,
          available_options: totalAvailableOptions
        });
        continue;
      }

      // Fallback fallback pointer if no attributes were requested yet
      if (!product) {
        product = products[0];
      }

      const requiredFields = product.required_fields || [];
      const availableOptions = product.allowed_options || product.attributes || {};
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        if (!mergedAttributes[field]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        missingProducts.push({
          product_name: product.name,
          missing_fields: missingFields,
          available_options: availableOptions,
        });
        continue;
      }

      // Stock Check
      const unitPrice = Number(product.price);
      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only ${product.stock} left for ${product.name}.` });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 1;
      
      grandSubtotal += subtotal;
      grandShipping += shipping;

      // Sync Validated Items to Database State Table
      const { error: upsertError } = await supabase
        .from("cart_sessions")
        .upsert(
          {
            session_id: sessionId,
            product_id: product.id,
            product_name: product.name,
            quantity: requestedQuantity,
            selected_attributes: mergedAttributes,
            current_flow: "ecommerce",
            current_step: "collecting_attributes",
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id' }
        );

      if (upsertError) {
        return NextResponse.json({ success: false, message: "Database update failed." }, { status: 500 });
      }
 
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: mergedAttributes,
        unit_price: unitPrice,
        subtotal,
      });
    }

    // =========================================================================
    // 5. EVALUATE TARGET MISSING/INVALID SELECTION PAYLOADS
    // =========================================================================
    if (missingProducts.length > 0) {
      const completelyNotFound = missingProducts.filter(p => p.error_type === "not_found");
      const invalidVariants = missingProducts.filter(p => p.error_type === "invalid_variant");

      // Scenario A: Completely missing from catalog lookups
      if (completelyNotFound.length > 0) {
        const { data: storeAlternatives } = await supabase.from('products').select('name').eq('user_id', user_id).limit(3);
        const suggestionsList = storeAlternatives ? storeAlternatives.map(p => p.name).join(", ") : "";
        const failedNames = completelyNotFound.map(p => `"${p.product_name}"`).join(" and ");

        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: `The item ${failedNames} is currently not matching our store catalog format. Try: ${suggestionsList}`
        });
      }

      // Scenario B: ⚡ INVALID VARIANT SELECTION (e.g., Red or size that doesn't exist)
      // Scenario B: INVALID VARIANT SELECTION (e.g., Color or Size combinations that don't exist)
      if (invalidVariants.length > 0) {
        const item = invalidVariants[0];
        
        // Safely extract the distinct options available in your Supabase rows
        const allowedColors = item.available_options?.color ? item.available_options.color.join(" or ") : "";
        const allowedSizes = item.available_options?.size ? item.available_options.size.join(", ") : "";
        
        let customErrorMessage = `Sorry, that specific combination is not available for ${item.product_name}.`;
        
        if (allowedColors || allowedSizes) {
          customErrorMessage += " We currently have this item available in:";
          if (allowedColors) customErrorMessage += `\n- Colors: ${allowedColors}`;
          if (allowedSizes) customErrorMessage += `\n- Sizes: ${allowedSizes}`;
        }
        
        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_products: missingProducts,
          message: customErrorMessage
        });
      }

      // Scenario C: Normal item attribute selection flow handler
      let userFriendlyMessage = "";
      if (missingProducts.length === 1) {
        const item = missingProducts[0];
        const missingFieldsList = item.missing_fields.join(" and ");
        userFriendlyMessage = `Please select options (${missingFieldsList}) for ${item.product_name}.`;
      } else {
        const itemMessages = missingProducts.map(item => `${item.product_name} (${item.missing_fields.join(", ")})`);
        const lastItemMessage = itemMessages.pop();
        userFriendlyMessage = `Please select required options for both ${itemMessages.join(" and ")} and ${lastItemMessage}.`;
      }

      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: userFriendlyMessage 
      });
    }

    // Success! All items verified cleanly
    return NextResponse.json({
      success: true,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping,
      message: "All products are available. Kindly share your Name, Email and Phone Number.",
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Error." }, { status: 500 });
  }
}