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

    if (!user_id) {
      return NextResponse.json({ success: false, message: "Missing user_id context." }, { status: 400 });
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
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      const search = product_name.trim();

      // 1. Fetch Product Scoped STRICTLY to the merchant user_id using build-safe Supabase chaining
      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id) 
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      // FALLBACK LOOKUP: If phrase search fails, isolate generic terms specifically for this merchant
      if ((!products || products.length === 0) && search.toLowerCase().includes(" ")) {
        const words = search.split(" ").filter(Boolean);
        let genericTerm = words[words.length - 1].toLowerCase(); 
        
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
          if (search.toLowerCase().includes("white") && !mergedAttributes.color) {
            mergedAttributes.color = "White";
          }
        }
      }

      // Catalog Recommendation Engine Fallback if item is completely missing
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
            message: `The item "${product_name}" is currently not available in our store catalog. However, you can check out these amazing options from our collection instead: ${suggestionsList}! Which one would you prefer?`
          });
        }

        return NextResponse.json({
          success: false,
          message: `Product not found: ${product_name}`,
        });
      }

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
        return NextResponse.json({
          success: false,
          message: "Database update failed.",
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