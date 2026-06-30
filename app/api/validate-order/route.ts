import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== NEW VALIDATE ORDER API V5 =====");
  try {
    const body = await req.json();
    const sessionId = body.session_id;
    const items = body.items;
    const user_id = body.user_id; // <--- CRITICAL: Extract user_id from incoming request body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    // Inside the POST function, right under your variables setup...
    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    let grandTotal = 0;

    const missingProducts: any[] = [];

    // 1. The loop starts here
    for (const item of items) {
      const { product_name, quantity, selected_attributes = {} } = item;
      const mergedAttributes = selected_attributes || {};
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity.` }, { status: 400 });
      }

      // 🛑 PLACE IT EXACTLY HERE (At the start of the item processing block):
      const productRequested = product_name.trim().toLowerCase();

      // This query acts as the tenant barrier wall
      let { data: products, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user_id) // 🔐 This isolates Customer A from Customer B dynamically
        .ilike('name', `%${productRequested}%`);

      // ==========================================================
      // Below this line, the code continues to check category rollbacks 
      // and variant match configurations...

      // BROAD CATEGORY INTERCEPTOR FALLBACK
      if (!products || products.length === 0) {
        let categoryFilter = `%${productRequested}%`;
        
        // Clean generalized keywords dynamically to match your database categories
        if (productRequested === "furniture") categoryFilter = "%furniture%";
        if (productRequested === "clothes" || productRequested === "apparel") categoryFilter = "%clothing%";

        // Fetch items belonging specifically to this store owner's targeted category row
        const { data: categoryProducts } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user_id)
          .ilike('category', categoryFilter);

        // If products are found inside that category row, prompt the user with dynamic alternatives
        if (categoryProducts && categoryProducts.length > 0) {
          const productSuggestions = categoryProducts
            .slice(0, 3)
            .map(p => p.name)
            .join(", ");

          return NextResponse.json({
            success: false,
            requires_selection: true, // Stops the checkout path and requests clarification
            intent: "validate_order",
            message: `We have several options available under that collection! Which one would you like to buy? (For example: ${productSuggestions})`
          });
        }

        // Adaptive phrase-split lookup fallback (e.g. "white tshirt")
        if (productRequested.includes(" ")) {
          const words = productRequested.split(" ").filter(Boolean);
          let genericTerm = words[words.length - 1]; 
          
          if (genericTerm === "tshirt" || genericTerm === "shirt") {
            genericTerm = "t-shirt";
          }
          
          const { data: fallbackProducts } = await supabase
            .from("products")
            .select("*")
            .eq('user_id', user_id)
            .or(`name.ilike.%${genericTerm}%,category.ilike.%${genericTerm}%`);
            
          if (fallbackProducts && fallbackProducts.length > 0) {
            products = fallbackProducts;
            if (productRequested.includes("white") && !mergedAttributes.color) {
              mergedAttributes.color = "White";
            }
          }
        }
      }

      // If absolutely no matches are found after name, category, and phrase splitting
      // Absolute fallback if product search yields 0 items across names and category pools
      if (productError || !products || products.length === 0) {
        
        // ✨ NEW DYNAMIC RECOMMENDATION ENGINE FOR VALIDATE_ORDER
        // Fetch up to 3 real items that THIS specific tenant store owner actually sells
        const { data: storeAlternatives } = await supabase
          .from('products')
          .select('name')
          .eq('user_id', user_id)
          .limit(3);

        if (storeAlternatives && storeAlternatives.length > 0) {
          const suggestionsList = storeAlternatives.map(p => p.name).join(", ");
          
          return NextResponse.json({
            success: false,
            requires_selection: true, // Forces the chatbot flow to wait for a correct item choice
            intent: "validate_order",
            message: `The item "${product_name}" is currently not available in our store catalog. However, you can buy these amazing products from our collection instead: ${suggestionsList}! Which one would you like to order?`
          });
        }

        // Complete emergency fallback if the merchant hasn't uploaded any products at all
        return NextResponse.json({
          success: false,
          requires_selection: false,
          intent: "chat",
          message: `The item "${product_name}" is currently not available in our store catalog. Please let me know if you would like to explore our other collections!`
        });
      }

      // Pick our reference item
      let product = products[0];

      // 2. Exact Variant Matching Logic against JSONB variants array
      if (Object.keys(mergedAttributes).length > 0) {
        const matchedProduct = products.find((p: any) => {
          return Object.entries(mergedAttributes).every(([key, value]) => {
            const dbValue = p.attributes?.[key];
            
            if (Array.isArray(dbValue)) {
              return dbValue.map(v => String(v).toLowerCase().trim())
                            .includes(String(value).toLowerCase().trim());
            }
            
            return (
              String(dbValue || "").toLowerCase().trim() ===
              String(value).toLowerCase().trim()
            );
          });
        });

        if (matchedProduct) {
          product = matchedProduct;
        }
      }

      console.log("MATCHED PRODUCT RECORD:", product);

      const requiredFields = product.required_fields || [];
      const availableOptions = product.allowed_options || {};
      const missingFields: string[] = [];

      // Evaluate missing required attributes
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

      // 3. Stock & Price Calculation
      const unitPrice = Number(product.price);
      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only ${product.stock} left for ${product.name}.` });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 1;
      
      grandSubtotal += subtotal;
      grandShipping += shipping;
      grandTotal += subtotal + shipping;

      // 4. Perform Upsert with Session State Sync
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
        console.error("UPSERT FAILED:", JSON.stringify(upsertError, null, 2));
        return NextResponse.json({
          success: false,
          message: "Database update failed.",
          details: upsertError.message
        }, { status: 500 });
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

    // 5. Trigger Missing Selection Payloads
    if (missingProducts.length > 0) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message:
          missingProducts.length === 1
            ? `Please select ${missingProducts[0].missing_fields.join(", ")} for ${missingProducts[0].product_name}.`
            : "Please provide the required attributes for each product."
      });
    }

    return NextResponse.json({
      success: true,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandTotal,
      message: "All products are available. Kindly share your Name, Email and Phone Number.",
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Error." }, { status: 500 });
  }
}