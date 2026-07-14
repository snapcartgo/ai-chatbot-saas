// app/api/whatsapp-validate-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== WHATSAPP VALIDATE ORDER API PRODUCTION =====");
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

    for (const item of items) {
      const { product_name, quantity, selected_attributes = {} } = item;
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      // ⚡ FIX: Normalize all incoming attribute keys to lowercase immediately
      const mergedAttributes = Object.entries(selected_attributes || {}).reduce((acc: any, [k, v]) => {
        acc[k.toLowerCase().trim()] = v;
        return acc;
      }, {});

      let search = product_name.trim().toLowerCase();

      search = search.replace(/\bsize\s*([a-z0-9]+)\b/g, '$1');
      search = search.replace(/\b(tshirt|t shirt|shirt)\b/g, 't-shirt');

      // 1. Primary Fuzzy Search
      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id) 
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      // 2. Fallback Split-Phrase Search
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

      if (productError || !products || products.length === 0) {
        missingProducts.push({
          product_name: product_name,
          error_type: "not_found"
        });
        continue; 
      }

      let product = null;
      let variantMatched = false;

      // Exact Variant Matching
      if (Object.keys(mergedAttributes).length > 0) {
        const matchedProduct = products.find((p: any) => {
          if (!p.attributes) return false;

          const dbAttributesNormalized = Object.entries(p.attributes).reduce((acc: any, [k, v]) => {
            acc[k.toLowerCase().trim()] = v;
            return acc;
          }, {});

          return Object.entries(mergedAttributes).every(([key, value]) => {
            const cleanKey = key.toLowerCase().trim();
            const targetVal = String(value).toLowerCase().trim();

            const dbValue1 = dbAttributesNormalized[cleanKey];
            const dbValue2 = dbAttributesNormalized[cleanKey === "color" ? "size" : "color"];

            if (!dbValue1) return false;

            const isMatchPrimary = Array.isArray(dbValue1)
              ? dbValue1.map(v => String(v).toLowerCase().trim()).includes(targetVal)
              : String(dbValue1).toLowerCase().trim() === targetVal;

            const isMatchSwapped = dbValue2 && (Array.isArray(dbValue2)
              ? dbValue2.map(v => String(v).toLowerCase().trim()).includes(targetVal)
              : String(dbValue2).toLowerCase().trim() === targetVal);

            return isMatchPrimary || isMatchSwapped;
          });
        });

        if (matchedProduct) {
          product = matchedProduct;
          variantMatched = true;
        }
      }

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
                if (!totalAvailableOptions.size.includes(strVal)) totalAvailableOptions.size.push(strVal);
              } else if (isStandardColorWord || key.toLowerCase() === "color" || cleanVal === "white" || cleanVal === "black") {
                if (!totalAvailableOptions.color.includes(strVal)) totalAvailableOptions.color.push(strVal);
              } else {
                if (!totalAvailableOptions[key]) totalAvailableOptions[key] = [];
                if (!totalAvailableOptions[key].includes(strVal)) totalAvailableOptions[key].push(strVal);
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

      if (!product) {
        product = products[0];
      }

      const requiredFields = product.required_fields || [];
      const availableOptions = product.allowed_options || product.attributes || {};
      const missingFields: string[] = [];

      // ⚡ FIX: Verified with fully lowercase mapping evaluation rules
      for (const field of requiredFields) {
        const cleanField = field.toLowerCase().trim();
        if (!mergedAttributes[cleanField]) {
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

      const unitPrice = Number(product.price);
      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only *${product.stock} items* left for *${product.name}*.` });
      }

      // ... (Stock Validation block directly above)
      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 40; 
      
      grandSubtotal += subtotal;
      grandShipping += shipping;

      // ==========================================
      // ADD THE CODE HERE (Replaces your old upsert)
      // ==========================================
      const { error: cartUpsertError } = await supabase
        .from("cart_sessions")
        .upsert(
          {
            session_id: sessionId, 
            product_id: product.id,
            product_name: product.name,
            quantity: requestedQuantity,
            selected_attributes: mergedAttributes,
            current_flow: "whatsapp_ecommerce",
            current_step: "checkout",
            updated_at: new Date().toISOString(),
          }
        );

      if (cartUpsertError) {
        console.error("Cart database save error:", cartUpsertError);
        return NextResponse.json({ success: false, message: "Database system error. Please try again." }, { status: 500 });
      }
      // ==========================================

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: mergedAttributes,
        unit_price: unitPrice,
        subtotal,
      });
    } // <-- This closes the for loop

    if (missingProducts.length > 0) {
      const completelyNotFound = missingProducts.filter(p => p.error_type === "not_found");
      const invalidVariants = missingProducts.filter(p => p.error_type === "invalid_variant");

      if (completelyNotFound.length > 0) {
        const { data: storeAlternatives } = await supabase.from('products').select('name').eq('user_id', user_id).limit(3);
        const suggestionsList = storeAlternatives ? storeAlternatives.map(p => p.name).join(", ") : "";
        const failedNames = completelyNotFound.map(p => `*"${p.product_name}"*`).join(" and ");

        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: `The item ${failedNames} was not found in our WhatsApp catalog.\n\n*Try options like:* _${suggestionsList}_`
        });
      }

      if (invalidVariants.length > 0) {
        const item = invalidVariants[0];
        const allowedColors = item.available_options?.color?.length ? item.available_options.color.join(" or ") : "";
        const allowedSizes = item.available_options?.size?.length ? item.available_options.size.join(", ") : "";
        
        let customErrorMessage = `Sorry, that specific combination is unavailable for *${item.product_name}*.`;
        
        if (allowedColors || allowedSizes) {
          customErrorMessage += "\n\n*We currently have this available in:*";
          if (allowedColors) customErrorMessage += `\n• *Colors:* _${allowedColors}_`;
          if (allowedSizes) customErrorMessage += `\n• *Sizes:* _${allowedSizes}_`;
        }
        
        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_products: missingProducts,
          message: customErrorMessage
        });
      }

      let userFriendlyMessage = "";

      const buildOptionsText = (item: any) => {
        const opts = item.available_options || {};
        const optionsStringArray: string[] = [];

        Object.entries(opts).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            optionsStringArray.push(`\n• *${label}s:* _${values.join(" or ")}_`);
          }
        });
        return optionsStringArray.length === 0 ? "" : `\n\n*Available choices:*${optionsStringArray.join("")}`;
      };

      if (missingProducts.length === 1) {
        const item = missingProducts[0];
        const missingFieldsList = item.missing_fields.join(" and ");

        userFriendlyMessage = `Please reply with your preferred *${missingFieldsList}* option for *${item.product_name}*.`;
        userFriendlyMessage += buildOptionsText(item);
      } else {
        userFriendlyMessage = `Please specify required options for the following products:\n`;
        missingProducts.forEach((item, index) => {
          const missingFieldsList = item.missing_fields.join(" and ");
          userFriendlyMessage += `\n*${index + 1}. ${item.product_name}* (Missing: ${missingFieldsList})${buildOptionsText(item)}`;
        });
      }

      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: userFriendlyMessage
      });
    }

    return NextResponse.json({
      success: true,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping,
      message: `🛍️ *Order Summary verified successfully!* \n\n*Subtotal:* ₹${grandSubtotal}\n*Shipping:* ${grandShipping === 0 ? "_FREE_" : `₹${grandShipping}`}\n*Total:* *₹${grandSubtotal + grandShipping}*\n\nKindly share your *Name, Email and Delivery Address* to complete checkout.`,
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: "Oops! An unexpected system error occurred." }, { status: 500 });
  }
}