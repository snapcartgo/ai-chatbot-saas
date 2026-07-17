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
      const mergedAttributes = { ...selected_attributes }; // shallow copy to prevent mutation bugs
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

      // ✨ FIX 1: Extract implicit color attributes from the product name string if not explicitly sent
      if (!mergedAttributes.color) {
        if (search.includes("black")) mergedAttributes.color = "Black";
        else if (search.includes("white")) mergedAttributes.color = "White";
        else if (search.includes("blue")) mergedAttributes.color = "Blue";
        else if (search.includes("red")) mergedAttributes.color = "Red";
      }

      // 1. Primary Fuzzy Search (Strictly scoped to user_id AND product_type = 'website')
      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id)
        .eq("product_type", "website")
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
          .eq("product_type", "website")
          .or(`name.ilike.%${genericTerm}%,category.ilike.%${genericTerm}%`);
          
        if (fallbackProducts && fallbackProducts.length > 0) {
          products = fallbackProducts;
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

      // ⚡ EXACT VARIANT MATCHING LOOKUP LAYER (CASE-INSENSITIVE FIX)
      if (Object.keys(mergedAttributes).length > 0) {
        const matchedProduct = products.find((p: any) => {
          return Object.entries(mergedAttributes).every(([key, value]) => {
            const dbValue1 = p.attributes?.[key];
            const dbValue2 = p.attributes?.[key === "color" ? "size" : "color"];

            const targetVal = String(value).toLowerCase().trim();
            if (!dbValue1) return false;

            const isMatchPrimary = Array.isArray(dbValue1)
              ? dbValue1.map((v: string) => String(v).toLowerCase().trim()).includes(targetVal)
              : String(dbValue1).toLowerCase().trim() === targetVal;

            const isMatchSwapped = dbValue2 && (Array.isArray(dbValue2)
              ? dbValue2.map((v: string) => String(v).toLowerCase().trim()).includes(targetVal)
              : String(dbValue2).toLowerCase().trim() === targetVal);

            return isMatchPrimary || isMatchSwapped;
          });
        });

        if (matchedProduct) {
          product = matchedProduct;
          variantMatched = true;
        }
      }

      // ⚡ VALIDATION CHECK: Case-Insensitive fallback grouping options collector
      if (!variantMatched && Object.keys(mergedAttributes).length > 0) {
        const totalAvailableOptions: Record<string, string[]> = { color: [], size: [] };
        
        products.forEach((p: any) => {
          if (p.attributes) {
            Object.entries(p.attributes).forEach(([key, val]) => {
              const strVal = String(val).trim();
              if (!strVal || strVal.toLowerCase() === "null") return;

              const cleanVal = strVal.toLowerCase();
              const isStandardSizeWord = /^(m|l|xl|s|xs|xxl|30|32|34|36|38|40|42)$/i.test(cleanVal);
              const isStandardColorWord = /^(black|white|blue|red|green|yellow|pink|grey|cream|beige|maroon|navy)$/i.test(cleanVal);

              if (isStandardSizeWord || key.toLowerCase() === "size" || cleanVal === "l" || cleanVal === "m") {
                if (!totalAvailableOptions.size.includes(strVal)) {
                  totalAvailableOptions.size.push(strVal);
                }
              } else if (isStandardColorWord || key.toLowerCase() === "color" || cleanVal === "white" || cleanVal === "black") {
                if (!totalAvailableOptions.color.includes(strVal)) {
                  totalAvailableOptions.color.push(strVal);
                }
              } else {
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

      // Fallback baseline assignment pointer if no attributes were requested yet
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
          error_type: "missing_attributes", // Explicit label
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
      const missingAttributes = missingProducts.filter(p => p.error_type === "missing_attributes");

      if (completelyNotFound.length > 0) {
        const { data: storeAlternatives } = await supabase
          .from('products')
          .select('name')
          .eq('user_id', user_id)
          .eq('product_type', 'website')
          .limit(3);
        const suggestionsList = storeAlternatives ? storeAlternatives.map(p => p.name).join(", ") : "";
        const failedNames = completelyNotFound.map(p => `"${p.product_name}"`).join(" and ");

        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: `The item ${failedNames} is currently not matching our store catalog format. Try: ${suggestionsList}`
        });
      }

      // ✨ FIX 2: Loop through ALL invalid variants instead of returning just the 1st one
      if (invalidVariants.length > 0) {
        let customErrorMessage = "Sorry, those specific combinations are not available:\n\n";
        
        invalidVariants.forEach((item, index) => {
          const allowedColors = item.available_options?.color?.length ? item.available_options.color.join(" or ") : "";
          const allowedSizes = item.available_options?.size?.length ? item.available_options.size.join(", ") : "";
          
          customErrorMessage += `${index + 1}. ${item.product_name}:\n`;
          if (allowedColors) customErrorMessage += `   • Colors: ${allowedColors}\n`;
          if (allowedSizes) customErrorMessage += `   • Sizes: ${allowedSizes}\n`;
          customErrorMessage += `\n`;
        });

        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_products: missingProducts,
          message: customErrorMessage.trim()
        });
      }

      // Scenario C: Multi-item Normal attribute selection missing flow handler
      let userFriendlyMessage = "";
      const buildOptionsText = (item: any) => {
        const opts = item.available_options || {};
        const optionsStringArray: string[] = [];

        Object.entries(opts).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            const label = key.charAt(0).toUpperCase() + key.slice(1) + "s";
            optionsStringArray.push(`\n- ${label}: ${values.join(" or ")}`);
          } else if (typeof values === "string" && values.trim().toLowerCase() !== "null" && values.trim() !== "") {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            optionsStringArray.push(`\n- ${label}: ${values}`);
          }
        });
        return optionsStringArray.length === 0 ? "" : `\nAvailable Choices:${optionsStringArray.join("")}`;
      };

      if (missingProducts.length === 1) {
        const item = missingProducts[0];
        const missingFieldsList = item.missing_fields.join(" and ");
        userFriendlyMessage = `Please select options (${missingFieldsList}) for ${item.product_name}.\n${buildOptionsText(item)}`;
      } else {
        userFriendlyMessage = `Please select required options for the following products:\n\n`;
        missingProducts.forEach((item, index) => {
          const missingFieldsList = item.missing_fields.join(" and ");
          userFriendlyMessage += `${index + 1}. ${item.product_name}\nMissing: ${missingFieldsList}\n${buildOptionsText(item)}\n\n`;
        });
        userFriendlyMessage = userFriendlyMessage.trim();
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