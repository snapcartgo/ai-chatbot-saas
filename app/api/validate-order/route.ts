import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== VALIDATE ORDER API V15 PRODUCTION =====");
  try {
    const body = await req.json();
    const sessionId = body.session_id;
    const incomingItems = body.items;
    const user_id = body.user_id; 

    if (!user_id) {
      return NextResponse.json({ success: false, message: "Missing user_id context." }, { status: 400 });
    }

    if (!Array.isArray(incomingItems) || incomingItems.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    // 🕒 1. LOOKUP THE EXISTING SINGLE ROW FOR THIS SESSION
    const { data: existingCartRows } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", sessionId);

    const existingRow = existingCartRows && existingCartRows.length > 0 ? existingCartRows[0] : null;

    // Build a clean tracking map
    let completeItemsMap: Record<string, any> = {};

    // 🔄 Recover memory history safely from the single primary row container
    if (existingRow) {
      const storedAttributes = existingRow.selected_attributes || {};
      
      if (storedAttributes.__multi_items_cart) {
        Object.entries(storedAttributes.__multi_items_cart).forEach(([key, item]: [string, any]) => {
          completeItemsMap[key] = item;
        });
      } else if (existingRow.product_name) {
        const oldKey = existingRow.product_name.trim().toLowerCase();
        completeItemsMap[oldKey] = {
          product_name: existingRow.product_name,
          quantity: existingRow.quantity || 1,
          selected_attributes: storedAttributes
        };
      }
    }

    // Merge/Overwrite with the items coming in right now from the client request
    incomingItems.forEach((item: any) => {
      let key = item.product_name.trim().toLowerCase();
      
      // Smart recovery structure: find a matching word group to replace, instead of appending
      let targetKey = key;
      const structuralMatch = Object.keys(completeItemsMap).find(existingKey => {
        return (existingKey.includes("jeans") && key.includes("jeans")) ||
               (existingKey.includes("t-shirt") && key.includes("tshirt")) ||
               (existingKey.includes("shirt") && key.includes("shirt"));
      });

      if (structuralMatch) {
        // Remove the outdated fuzzy reference name key entirely to prevent duplicate iteration tracking loops
        const oldData = completeItemsMap[structuralMatch];
        delete completeItemsMap[structuralMatch];
        
        completeItemsMap[key] = {
          product_name: item.product_name,
          quantity: item.quantity || oldData.quantity,
          selected_attributes: {
            ...oldData.selected_attributes,
            ...item.selected_attributes
          }
        };
      } else {
        completeItemsMap[key] = item;
      }
    });

    // ✨ FIX: Explicit type structure assignment removes ts(7005) compilation bugs instantly
    const finalItemsToValidate = Object.values(completeItemsMap);
    const isMultiProductSession = finalItemsToValidate.length > 1;

    const validatedItems: any[] = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    const missingProducts: any[] = [];

    // Loop through the complete combined items list
    for (const item of finalItemsToValidate) {
      const { product_name, quantity, selected_attributes = {} } = item as any;
      const mergedAttributes = { ...selected_attributes }; 
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      let search = product_name.trim().toLowerCase();

      if (search === "tshirt" || search === "t shirt" || search === "shirt") {
        search = "t-shirt";
      }

      // Extract implicit color attributes from the product name string if not explicitly sent
      if (!mergedAttributes.color || mergedAttributes.color === "") {
        if (search.includes("black")) mergedAttributes.color = "Black";
        else if (search.includes("white")) mergedAttributes.color = "White";
        else if (search.includes("blue")) mergedAttributes.color = "Blue";
        else if (search.includes("red")) mergedAttributes.color = "Red";
      }

      // Strip blank input text tags out of validation metrics completely
      Object.keys(mergedAttributes).forEach(k => {
        if (mergedAttributes[k] === "") delete mergedAttributes[k];
      });

      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id)
        .eq("product_type", "website")
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      if ((!products || products.length === 0) && search.includes(" ")) {
        const words = search.split(" ").filter(Boolean);
        let genericTerm = words[words.length - 1]; 
        if (genericTerm === "tshirt" || genericTerm === "shirt") genericTerm = "t-shirt";
        
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

      if (productError || !products || products.length === 0) {
        missingProducts.push({ product_name: product_name, error_type: "not_found" });
        continue; 
      }

      let product = null;
      let variantMatched = false;

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

      if (!product) product = products[0];

      const requiredFields = product.required_fields || [];
      const availableOptions = product.allowed_options || product.attributes || {};
      const missingFields: string[] = [];

      for (const field of requiredFields) {
        if (!mergedAttributes[field]) missingFields.push(field);
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

      // Stock Check
      const unitPrice = Number(product.price);
      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only ${product.stock} left for ${product.name}.` });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 1;
      
      grandSubtotal += subtotal;
      grandShipping += shipping;
 
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: mergedAttributes,
        unit_price: unitPrice,
        subtotal,
      });
    }

    if (missingProducts.length > 0) {
      const invalidVariants = missingProducts.filter(p => p.error_type === "invalid_variant");
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
        return NextResponse.json({ success: false, requires_selection: true, message: customErrorMessage.trim() });
      }

      let userFriendlyMessage = "Please select required options for the following products:\n\n";
      missingProducts.forEach((item, index) => {
        const missingFieldsList = item.missing_fields.join(" and ");
        userFriendlyMessage += `${index + 1}. ${item.product_name}\nMissing: ${missingFieldsList}\n\n`;
      });
      return NextResponse.json({ success: false, requires_selection: true, message: userFriendlyMessage.trim() });
    }

    // =========================================================================
    // 💾 SECURE JSONB CART CONTAINER UPSERT
    // =========================================================================
    const primaryProduct = validatedItems[0];
    
    const nestedCartData: Record<string, any> = {};
    Object.entries(completeItemsMap).forEach(([k, v]: [string, any]) => {
      const matchedValid = validatedItems.find(vi => 
        vi.product_name.toLowerCase().trim() === k.toLowerCase().trim() || 
        k.includes(vi.product_name.toLowerCase().trim()) || 
        vi.product_name.toLowerCase().trim().includes(k)
      );
      const finalKey = matchedValid ? matchedValid.product_name.toLowerCase().trim() : k;
      nestedCartData[finalKey] = {
        product_name: matchedValid ? matchedValid.product_name : v.product_name,
        quantity: matchedValid ? matchedValid.quantity : v.quantity,
        selected_attributes: matchedValid ? matchedValid.selected_attributes : v.selected_attributes
      };
    });

    const payload = {
      session_id: sessionId,
      product_id: primaryProduct.product_id,
      product_name: isMultiProductSession ? "Multiple Items Package" : primaryProduct.product_name,
      quantity: isMultiProductSession ? finalItemsToValidate.length : primaryProduct.quantity,
      selected_attributes: {
        ...primaryProduct.selected_attributes,
        __multi_items_cart: nestedCartData 
      }, 
      current_flow: "ecommerce",
      current_step: "collecting_attributes",
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("cart_sessions")
      .upsert(payload, { onConflict: "session_id" });

    if (upsertError) {
      console.error("Upsert Error:", upsertError);
      return NextResponse.json({ success: false, message: "Database update failed." }, { status: 500 });
    }

    if (isMultiProductSession) {
      const itemsSummary = validatedItems
        .map(i => {
          const attrs = Object.entries(i.selected_attributes).map(([k, v]) => `${k}: ${v}`).join(", ");
          return `• ${i.product_name}${attrs ? ` (${attrs})` : ""}`;
        })
        .join("\n");

      return NextResponse.json({
        success: true,
        requires_confirmation: true, 
        items: validatedItems,
        subtotal: grandSubtotal,
        shipping: grandShipping,
        total: grandSubtotal + grandShipping,
        message: `Great! I've confirmed everything is in stock:\n\n${itemsSummary}\n\nAre you interested to buy these products? Kindly confirm. Yes.`,
      });
    }

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