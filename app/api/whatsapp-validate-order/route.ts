// app/api/whatsapp-validate-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Robust normalization to match generic user inputs with actual store product names
const normalizeProductName = (name: string) => {
  if (!name) return "";
  let clean = name.toLowerCase().trim();

  // Strip generic adjectives
  clean = clean
    .replace(/\b(premium|cotton|slim|fit|regular|mens|womens|casual)\b/g, "")
    .trim();

  if (/^(tshirt|t-shirt|t shirt|shirt)s?$/i.test(clean) || clean.includes("shirt")) {
    return "t-shirt";
  }
  if (clean.includes("jean") || clean.includes("denim") || clean.includes("pant")) {
    return "jeans";
  }
  
  return clean.replace(/s\b/g, "");
};

export async function POST(req: NextRequest) {
  console.log("===== WHATSAPP VALIDATE ORDER API PRODUCTION =====");
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (parseError) {
      console.log("Standard req.json() failed, trying raw text fallback...");
      try {
        const rawText = await req.text();
        if (rawText && rawText.trim()) {
          body = JSON.parse(rawText.trim());
        }
      } catch (jsonError) {
        console.error("Failed to parse raw body text:", jsonError);
        return NextResponse.json({ success: false, message: "Invalid JSON format payload." }, { status: 400 });
      }
    }

    const sessionId = body.session_id; 
    const items = body.items;
    const user_id = body.user_id;

    console.log("--> Received User ID:", user_id);
    console.log("--> Received Items array:", JSON.stringify(items));

    if (!user_id) {
      return NextResponse.json({ success: false, message: "Missing user_id context." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    // 🕒 LOOKUP PRIOR SESSION STATE
    const { data: existingCartRows } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", sessionId);

    let finalItemsToProcess: any[] = [];

    const isBuyIntent = body.intent === "buy" || !!body.customer_info;

    if (isBuyIntent && existingCartRows && existingCartRows.length > 0) {
      // 🟢 BUY INTENT: Lock in ALL items currently saved in DB cart session!
      finalItemsToProcess = existingCartRows.map((dbItem: any) => ({
        product_name: dbItem.product_name,
        quantity: dbItem.quantity,
        selected_attributes: dbItem.selected_attributes || {},
      }));
    } else {
      // 🟢 FOLLOW-UP / VALIDATION INTENT
      const isFollowUpTurn = 
        existingCartRows && 
        existingCartRows.length > 0 && 
        existingCartRows.length >= items.length;

      if (isFollowUpTurn) {
        finalItemsToProcess = existingCartRows.map((dbItem: any) => ({
          product_name: dbItem.product_name,
          quantity: dbItem.quantity,
          selected_attributes: dbItem.selected_attributes || {},
        }));

        items.forEach((incomingItem: any) => {
          const incomingNormalized = normalizeProductName(incomingItem.product_name);
          const targetIndex = finalItemsToProcess.findIndex(
            (i: any) => normalizeProductName(i.product_name) === incomingNormalized
          );

          if (targetIndex !== -1) {
            finalItemsToProcess[targetIndex].selected_attributes = {
              ...(finalItemsToProcess[targetIndex].selected_attributes || {}),
              ...(incomingItem.selected_attributes || {}),
            };
          }
        });
      } else {
        finalItemsToProcess = items.map((item: any) => ({ ...item }));
      }
    }
    const isMultiProductSession = finalItemsToProcess.length > 1;

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;

    const missingProducts: any[] = [];

    // Stage 1: Gather and Validate Everything
    for (const item of finalItemsToProcess) {
      const { product_name, quantity, selected_attributes = {} } = item;
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      const cleanIncomingAttributes = Object.entries(selected_attributes || {}).reduce((acc: any, [k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          acc[k.toLowerCase().trim()] = v;
        }
        return acc;
      }, {});

      let search = product_name.trim().toLowerCase();

      if (/^(tshirt|t-shirt|t shirt|shirt)s?$/i.test(search)) {
        search = "t-shirt";
      } else {
        search = search
          .replace(/\bt\s+shirts?\b/g, 't-shirt')
          .replace(/\btshirts?\b/g, 't-shirt')
          .replace(/s\b/g, '');
      }

      if (!cleanIncomingAttributes.color) {
        if (search.includes("black")) cleanIncomingAttributes.color = "black";
        else if (search.includes("white")) cleanIncomingAttributes.color = "white";
        else if (search.includes("blue")) cleanIncomingAttributes.color = "blue";
        else if (search.includes("red")) cleanIncomingAttributes.color = "red";
      }

      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id) 
        .eq("product_type", "meta")
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      if ((!products || products.length === 0) && search.includes(" ")) {
        const words = search.split(" ").filter(Boolean);
        let genericTerm = words[words.length - 1]; 
        
        if (/^(tshirt|t-shirt|t shirt|shirt)s?$/i.test(genericTerm)) {
          genericTerm = "t-shirt";
        }
        
        const { data: fallbackProducts } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user_id) 
          .eq("product_type", "meta")
          .or(`name.ilike.%${genericTerm}%,category.ilike.%${genericTerm}%`);
          
        if (fallbackProducts && fallbackProducts.length > 0) {
          products = fallbackProducts;
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
      if (Object.keys(cleanIncomingAttributes).length > 0) {
        const matchedProduct = products.find((p: any) => {
          if (!p.attributes) return false;

          const dbAttributesNormalized = Object.entries(p.attributes).reduce((acc: any, [k, v]) => {
            acc[k.toLowerCase().trim()] = v;
            return acc;
          }, {});

          return Object.entries(cleanIncomingAttributes).every(([key, value]) => {
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

      // 🟢 FIX: If this is the final "buy" intent / checkout step, DO NOT reject the item if variant matching was previously satisfied!
      const isBuyIntent = body.intent === "buy" || !!body.customer_info;

      if (!product) {
        product = products[0]; // Fallback to primary matched product entry
      }

      // If we are in "buy" intent, bypass strict re-validation failure so confirmed items are never dropped
      if (!variantMatched && !isBuyIntent && Object.keys(cleanIncomingAttributes).length > 0) {
        const totalAvailableOptions: Record<string, string[]> = { color: [], size: [] };
        
        products.forEach((p: any) => {
          if (p.attributes) {
            Object.entries(p.attributes).forEach(([key, val]) => {
              if (!val || String(val).toLowerCase() === "null") return;
              const cleanKey = key.toLowerCase().trim();
              const valuesArray = Array.isArray(val) ? val : String(val).split(",").map(v => v.trim());

              valuesArray.forEach(strVal => {
                const cleanVal = String(strVal).toLowerCase().trim();
                if (!cleanVal) return;

                if (cleanKey === "size" || /^(m|l|xl|s|xs|xxl|30|32|34|36|38|40|42)$/i.test(cleanVal)) {
                  if (!totalAvailableOptions.size.includes(strVal)) totalAvailableOptions.size.push(strVal);
                } else if (cleanKey === "color" || /^(black|white|blue|red|green|yellow|pink|grey)$/i.test(cleanVal)) {
                  if (!totalAvailableOptions.color.includes(strVal)) totalAvailableOptions.color.push(strVal);
                }
              });
            });
          }
        });

        missingProducts.push({
          product_name: products[0].name,
          error_type: "invalid_variant",
          available_options: totalAvailableOptions
        });
        continue; 
      }

      if (!product) {
        product = products[0];
      }

      if (!variantMatched && Object.keys(cleanIncomingAttributes).length === 0 && product.required_fields && product.required_fields.length > 0) {
        const totalAvailableOptions: Record<string, string[]> = { color: [], size: [] };
        
        products.forEach((p: any) => {
          if (p.attributes) {
            Object.entries(p.attributes).forEach(([key, val]) => {
              if (!val || String(val).toLowerCase() === "null") return;
              
              const cleanKey = key.toLowerCase().trim();
              const valuesArray = Array.isArray(val) ? val : String(val).split(",").map(v => v.trim());

              valuesArray.forEach(strVal => {
                const cleanVal = String(strVal).toLowerCase().trim();
                if (!cleanVal) return;

                if (cleanKey === "size" || /^(m|l|xl|s|xs|xxl|30|32|34|36|38|40|42)$/i.test(cleanVal)) {
                  if (!totalAvailableOptions.size.includes(strVal)) totalAvailableOptions.size.push(strVal);
                } else if (cleanKey === "color" || /^(black|white|blue|red|green|yellow|pink|grey)$/i.test(cleanVal)) {
                  if (!totalAvailableOptions.color.includes(strVal)) totalAvailableOptions.color.push(strVal);
                }
              });
            });
          }
        });

        if (totalAvailableOptions.color.length > 0 || totalAvailableOptions.size.length > 0) {
          missingProducts.push({
            product_name: product.name,
            error_type: "missing_attributes",
            missing_fields: product.required_fields,
            available_options: totalAvailableOptions
          });
          continue;
        }
      }

      const requiredFields = product.required_fields || [];
      const availableOptions = product.allowed_options || product.attributes || {};
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        const cleanField = field.toLowerCase().trim();
        if (!cleanIncomingAttributes[cleanField]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        missingProducts.push({
          product_name: product.name,
          error_type: "missing_attributes",
          missing_fields: missingFields,
          available_options: availableOptions,
        });
        continue;
      }

      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only *${product.stock} items* left for *${product.name}*.` });
      }

      const unitPrice = Number(product.price);
      const subtotal = unitPrice * requestedQuantity;

      grandSubtotal += subtotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: cleanIncomingAttributes,
        unit_price: unitPrice,
        subtotal,
      });
    }

    grandShipping = grandSubtotal >= 999 ? 0 : 40; 

    // SAVE INTERMEDIATE DRAFT CART TO DB SO FOLLOW-UP TURNS REMEMBER ALL ITEMS
    await supabase
      .from("cart_sessions")
      .delete()
      .eq("session_id", sessionId);

    // Write all current working items to DB
    for (const item of finalItemsToProcess) {
      await supabase
        .from("cart_sessions")
        .upsert({
          session_id: sessionId, 
          product_id: item.product_id || "draft_item",
          product_name: item.product_name,
          quantity: item.quantity,
          selected_attributes: item.selected_attributes || {},
          current_flow: "whatsapp_ecommerce",
          current_step: missingProducts.length > 0 ? "collect_attributes" : "checkout",
          updated_at: new Date().toISOString(),
        });
    }

    // Handle Validation Failures Early (Stop and ask for attributes)
    if (missingProducts.length > 0) {
      const completelyNotFound = missingProducts.filter(p => p.error_type === "not_found");
      const invalidVariants = missingProducts.filter(p => p.error_type === "invalid_variant");

      if (completelyNotFound.length > 0) {
        const { data: storeAlternatives } = await supabase
          .from('products')
          .select('name')
          .eq('user_id', user_id)
          .eq('product_type', 'meta')
          .limit(3);

        const suggestionsList = storeAlternatives ? storeAlternatives.map(p => p.name).join(", ") : "";
        const failedNames = completelyNotFound.map(p => `*"${p.product_name}"*`).join(" and ");

        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: `The item ${failedNames} was not found in our WhatsApp catalog.\n\n*Try options like:* _${suggestionsList}_`
        });
      }

      if (invalidVariants.length > 0) {
        let customErrorMessage = "Sorry, those specific combinations are unavailable:\n";
        
        invalidVariants.forEach((item, index) => {
          const allowedColors = item.available_options?.color?.length ? item.available_options.color.join(" or ") : "";
          const allowedSizes = item.available_options?.size?.length ? item.available_options.size.join(", ") : "";
          
          customErrorMessage += `\n*${index + 1}. ${item.product_name}:*`;
          if (allowedColors) customErrorMessage += `\n   • *Colors:* _${allowedColors}_`;
          if (allowedSizes) customErrorMessage += `\n   • *Sizes:* _${allowedSizes}_`;
          customErrorMessage += `\n`;
        });
        
        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_products: missingProducts,
          message: customErrorMessage.trim()
        });
      }

      let userFriendlyMessage = "";

      const buildOptionsText = (item: any) => {
        const opts = item.available_options || {};
        const optionsStringArray: string[] = [];

        Object.entries(opts).forEach(([key, values]) => {
          let parsedValues: string[] = [];
          if (Array.isArray(values)) {
            parsedValues = values;
          } else if (typeof values === "string") {
            parsedValues = values.split(",").map(v => v.trim());
          }

          if (parsedValues.length > 0) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            optionsStringArray.push(`\n• *${label}s:* _${parsedValues.join(" or ")}_`);
          }
        });
        return optionsStringArray.join("");
      };

      if (missingProducts.length === 1) {
        const item = missingProducts[0];
        const missingFieldsList = item.missing_fields.join(" and ");
        const choices = buildOptionsText(item);

        userFriendlyMessage = `Please reply with your preferred *${missingFieldsList}* option for *${item.product_name}*.`;
        if (choices) {
          userFriendlyMessage += `\n\n*AVAILABLE CHOICES:*${choices}`;
        }
      } else {
        userFriendlyMessage = `Please specify required options for the following products:\n`;
        
        missingProducts.forEach((item, index) => {
          const missingFieldsList = item.missing_fields.join(" and ");
          userFriendlyMessage += `\n*${index + 1}. ${item.product_name}* (Missing: ${missingFieldsList})`;
        });

        userFriendlyMessage += `\n\n*AVAILABLE CHOICES:*`;
        missingProducts.forEach((item) => {
          const choices = buildOptionsText(item);
          if (choices) {
            userFriendlyMessage += `\n\n*For ${item.product_name}:*${choices}`;
          }
        });
      }

      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: userFriendlyMessage
      });
    }

    // Return Clean Success Output Structure
    if (isMultiProductSession) {
      const itemsSummary = validatedItems
        .map(i => {
          const attrs = Object.entries(i.selected_attributes)
            .map(([k, v]) => `*${k}:* _${v}_`)
            .join(", ");
          return `• *${i.product_name}* ${attrs ? `(${attrs})` : ""}`;
        })
        .join("\n");

      return NextResponse.json({
        success: true,
        requires_confirmation: true, 
        items: validatedItems,
        subtotal: grandSubtotal,
        shipping: grandShipping,
        total: grandSubtotal + grandShipping,
        message: `Great! I've confirmed everything is in stock:\n\n${itemsSummary}\n\n*Subtotal:* ₹${grandSubtotal}\n*Shipping:* ${grandShipping === 0 ? "_FREE_" : `₹${grandShipping}`}\n*Total:* *₹${grandSubtotal + grandShipping}*\n\nAre you interested to buy these products? Kindly confirm. Yes. Kindly share your *Name, Email, phone and Delivery Address* to complete checkout.`,
      });
    }

    return NextResponse.json({
      success: true,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping,
      message: `🛍️ *Order Summary verified successfully!* \n\n*Subtotal:* ₹${grandSubtotal}\n*Shipping:* ${grandShipping === 0 ? "_FREE_" : `₹${grandShipping}`}\n*Total:* *₹${grandSubtotal + grandShipping}*\n\nKindly share your *Name, Email, phone and Delivery Address* to complete checkout.`,
    });

  } catch (err: any) {
    console.error("Critical Route Error:", err);
    return NextResponse.json({ success: false, message: "Oops! An unexpected system error occurred." }, { status: 500 });
  }
}