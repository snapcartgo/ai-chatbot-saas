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

    // Fetch existing cart
    const { data: cart } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    let grandTotal = 0;

    for (const item of items) {
      const { product_name, quantity, selected_attributes = {} } = item;

      const mergedAttributes = selected_attributes || {};

      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      // 1. Fetch Product
      const search = product_name.trim();

const { data: products, error: productError } = await supabase
  .from("products")
  .select("*")
  .or(
    `name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`
  );

if (productError || !products || products.length === 0) {
  return NextResponse.json({
    success: false,
    message: `Product not found: ${product_name}`,
  });
}

let product = products[0];

// If the user has already selected attributes,
// try to find the exact matching variant.
if (Object.keys(selected_attributes).length > 0) {
  const matchedProduct = products.find((p: any) => {
    return Object.entries(selected_attributes).every(([key, value]) => {
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

// Continue here...
console.log("PRODUCT:", product);
console.log("TYPE OF ATTRIBUTES:", typeof product.attributes);
console.log("ATTRIBUTES:", product.attributes);

const requiredFields = product.required_fields || [];
const availableOptions = product.allowed_options || {};

  
console.log("MERGED ATTRIBUTES:", mergedAttributes);

      const missingFields: string[] = [];

for (const field of requiredFields) {
  if (!mergedAttributes[field]) {
    missingFields.push(field);
  }
}

if (missingFields.length > 0) {
  return NextResponse.json({
    success: false,
    requires_selection: true,
    missing_fields: missingFields,
    available_options: availableOptions,
    message: `Please select ${missingFields.join(", ")}`
  });
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

      
      // 4. Perform Upsert with onConflict
      const { data, error: upsertError } = await supabase
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
          { onConflict: 'session_id' } // CRITICAL: This tells Supabase which column makes the row unique
        )
        .select();

      if (upsertError) {
        console.error("UPSERT FAILED:", JSON.stringify(upsertError, null, 2));
        return NextResponse.json({
          success: false,
          message: "Database update failed.",
          details: upsertError.message // View this in your API response
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