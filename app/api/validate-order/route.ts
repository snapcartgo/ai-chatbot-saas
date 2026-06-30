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

      let product = products[0];

      // Exact Variant Matching Logic against JSONB variants array
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
        if (matchedProduct) product = matchedProduct;
      }

      const requiredFields = product.required_fields || [];
      const availableOptions = product.allowed_options || {};
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

    // 5. Trigger Missing Selection Payloads (PERMANENT MULTI-ITEM FIX)
    if (missingProducts.length > 0) {
      // Dynamically list the names of all items that are missing fields
      const itemsNeedingOptions = missingProducts.map(p => p.product_name);
      
      // Construct a clean, unified message listing all items
      let userFriendlyMessage = "";
      if (itemsNeedingOptions.length === 1) {
        userFriendlyMessage = `Please select options (size/color) for ${itemsNeedingOptions[0]}.`;
      } else {
        // Creates a clean list: "Premium Cotton T-Shirt and Slim Fit Jeans"
        const lastItem = itemsNeedingOptions.pop();
        userFriendlyMessage = `Please select options (size/color) for both ${itemsNeedingOptions.join(", ")} and ${lastItem}.`;
      }

      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: userFriendlyMessage // ⚡ Sends the complete list to the chatbot window!
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