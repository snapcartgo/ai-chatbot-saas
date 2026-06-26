import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, items, confirmed } = body;

    // 1. Fetch existing cart
    const { data: cart } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    let grandTotal = 0;

    // 2. Validate all items first (Looping only for logic/math)
    for (const item of items) {
      const { product_name, quantity, selected_attributes = {} } = item;
      
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .ilike("name", product_name.trim());

      if (!products || products.length === 0) {
        return NextResponse.json({ success: false, message: `Product not found: ${product_name}` });
      }

      const product = products[0];
      const requestedQuantity = Number(quantity);
      
      // Stock Check
      if (requestedQuantity > Number(product.stock)) {
        return NextResponse.json({ success: false, message: `Only ${product.stock} left for ${product.name}.` });
      }

      const subtotal = Number(product.price) * requestedQuantity;
      grandSubtotal += subtotal;
      grandTotal += subtotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: { ...(cart?.selected_attributes || {}), ...selected_attributes },
        subtotal
      });
    }

    // 3. CONFIRMATION GATE (Stops the process if user hasn't confirmed)
    if (!confirmed) {
      return NextResponse.json({
        success: true,
        requires_confirmation: true,
        summary: { items: validatedItems, total: grandTotal },
        message: `You selected ${items.length} item(s). Total: $${grandTotal}. Please confirm to proceed.`,
      });
    }

    // 4. SAVE TO DATABASE (Done once, outside the loop)
    const { error: upsertError } = await supabase
      .from("cart_sessions")
      .upsert({
        session_id: session_id,
        selected_attributes: validatedItems[0].selected_attributes,
        current_step: "collecting_user_details",
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      message: "Order confirmed. Please share your Name, Email, and Phone Number."
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Error." }, { status: 500 });
  }
}