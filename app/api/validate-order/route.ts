import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("===== NEW VALIDATE ORDER API V6 =====");
  try {
    const body = await req.json();
    const sessionId = body.session_id;
    const items = body.items;
    const user_id = body.user_id; 
    const intent = body.intent; // Check incoming action state

    // ⚡ PRO FIX: If the n8n flow is trying to finalize/checkout an existing valid cart session
    if (intent === "validate_order" && sessionId && (!items || items.length === 0)) {
      const { data: activeCart, error: cartError } = await supabase
        .from("cart_sessions")
        .select("*")
        .eq("session_id", sessionId);

      if (!cartError && activeCart && activeCart.length > 0) {
        // Map data straight out of the session records that HTTP Request2 already verified!
        let grandSubtotal = 0;
        const validatedItems = activeCart.map(item => {
          // You can query your products pricing safely here using product_id
          const unitPrice = 2; // Grab or fallback to standard price config
          const subtotal = unitPrice * Number(item.quantity);
          grandSubtotal += subtotal;

          return {
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            selected_attributes: item.selected_attributes,
            unit_price: unitPrice,
            subtotal
          };
        });

        const grandShipping = grandSubtotal >= 999 ? 0 : 1;

        return NextResponse.json({
          success: true,
          items: validatedItems,
          subtotal: grandSubtotal,
          shipping: grandShipping,
          total: grandSubtotal + grandShipping,
          message: "All products are available. Kindly share your Name, Email and Phone Number.",
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    let grandTotal = 0;
    const missingProducts: any[] = [];

    for (const item of items) {
      const { product_name, quantity, selected_attributes = {} } = item;
      const mergedAttributes = selected_attributes || {};
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity.` }, { status: 400 });
      }

      const productRequested = product_name.trim().toLowerCase();

      // Look for an exact match or an ilike match directly first
      let { data: products, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', user_id) 
        .or(`name.ilike.%${productRequested}%,name.eq.${product_name}`); // Added strict equal evaluation matching

      // BROAD CATEGORY INTERCEPTOR FALLBACK
      if (!products || products.length === 0) {
        let categoryFilter = `%${productRequested}%`;
        
        if (productRequested === "furniture") categoryFilter = "%furniture%";
        if (productRequested === "clothes" || productRequested === "apparel") categoryFilter = "%clothing%";

        const { data: categoryProducts } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user_id)
          .ilike('category', categoryFilter);

        if (categoryProducts && categoryProducts.length > 0) {
          const productSuggestions = categoryProducts.slice(0, 3).map(p => p.name).join(", ");
          return NextResponse.json({
            success: false,
            requires_selection: true, 
            intent: "validate_order",
            message: `We have several options available under that collection! Which one would you like to buy? (For example: ${productSuggestions})`
          });
        }

        // Adaptive phrase-split lookup fallback
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

      // Absolute fallback structure validation
      if (productError || !products || products.length === 0) {
        const { data: storeAlternatives } = await supabase
          .from('products')
          .select('name')
          .eq('user_id', user_id)
          .limit(3);

        if (storeAlternatives && storeAlternatives.length > 0) {
          const suggestionsList = storeAlternatives.map(p => p.name).join(", ");
          return NextResponse.json({
            success: false,
            requires_selection: true, 
            intent: "validate_order",
            message: `The item "${product_name}" is currently not available in our store catalog. However, you can buy these amazing products from our collection instead: ${suggestionsList}! Which one would you like to order?`
          });
        }

        return NextResponse.json({
          success: false,
          requires_selection: false,
          intent: "chat",
          message: `The item "${product_name}" is currently not available in our store catalog. Please let me know if you would like to explore our other collections!`
        });
      }

      let product = products[0];

      // Exact Variant Matching Logic
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
        if (!mergedAttributes[field]) missingFields.push(field);
      }

      if (missingFields.length > 0) {
        missingProducts.push({
          product_name: product.name,
          missing_fields: missingFields,
          available_options: availableOptions,
        });
        continue;
      }

      const unitPrice = Number(product.price || 2); // Dynamic fallback
      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only ${product.stock} left for ${product.name}.` });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 1;
      
      grandSubtotal += subtotal;
      grandShipping += shipping;
      grandTotal += subtotal + shipping;

      const { error: upsertError } = await supabase
        .from("cart_sessions")
        .upsert({
          session_id: sessionId,
          product_id: product.id,
          product_name: product.name,
          quantity: requestedQuantity,
          selected_attributes: mergedAttributes,
          current_flow: "ecommerce",
          current_step: "collecting_attributes",
          updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });

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

    if (missingProducts.length > 0) {
      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: missingProducts.length === 1
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