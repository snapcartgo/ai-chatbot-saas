import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
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

      const mergedAttributes = {
        ...(cart?.selected_attributes || {}),
        ...selected_attributes
      };

      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      // 1. Fetch Product
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .ilike("name", product_name.trim()); 

      if (productError || !products || products.length === 0) {
        return NextResponse.json({ success: false, message: `Product not found: ${product_name}` });
      }

      const product = products[0];
      const productAttributes = product.attributes || {};

      // 2. Validation Logic (Simplified for brevity)
      // ... [Keep your existing validation logic here] ...

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