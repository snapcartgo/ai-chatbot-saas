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

      // 1. Fetch Product with Adaptive Fuzzy Text Matching
      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      // FALLBACK LOOKUP: If "White T-Shirt" yields no results, split the phrase
      if ((!products || products.length === 0) && search.toLowerCase().includes(" ")) {
        const words = search.split(" ").filter(Boolean);
        // Look for the generic noun keyword (e.g., "T-Shirt") anywhere in name or category
        const genericTerm = words[words.length - 1]; 
        
        const { data: fallbackProducts } = await supabase
          .from("products")
          .select("*")
          .or(`name.ilike.%${genericTerm}%,category.ilike.%${genericTerm}%`);
          
        if (fallbackProducts && fallbackProducts.length > 0) {
          products = fallbackProducts;
          // Automatically backfill the implied color if it isn't set yet
          if (search.toLowerCase().includes("white") && !mergedAttributes.color) {
            mergedAttributes.color = "White";
          }
        }
      }

      if (productError || !products || products.length === 0) {
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
            return (
              String(p.attributes?.[key] || "").toLowerCase() ===
              String(value).toLowerCase()
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
        // Continue tracking other items in payload loops safely
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