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

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    const validatedItems = [];
    let grandTotal = 0;

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
      const productAttributes = product.attributes || {};

      // 1. Strict Attribute Validation
      for (const key in productAttributes) {
        const allowed = Array.isArray(productAttributes[key]) ? productAttributes[key] : [];
        if (!selected_attributes[key]) {
          return NextResponse.json({ success: false, message: `Please specify ${key} for ${product_name}. Available: ${allowed.join(", ")}` });
        }
      }

      const subtotal = Number(product.price) * Number(quantity);
      grandTotal += subtotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        selected_attributes,
        subtotal
      });
    }

    // 2. INTEGRATED CONFIRMATION GATE
    if (!confirmed) {
      return NextResponse.json({
        success: true,
        requires_confirmation: true,
        summary: { items: validatedItems, total: grandTotal },
        message: `You selected ${items.length} item(s). Total: $${grandTotal}. Please type 'confirm' to proceed.`,
      });
    }

    // 3. FINAL SAVE
    const { error } = await supabase
      .from("cart_sessions")
      .upsert({
        session_id: session_id,
        selected_attributes: validatedItems[0].selected_attributes,
        current_step: "collecting_user_details",
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Order confirmed. Please share your Name, Email, and Phone Number."
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Error." }, { status: 500 });
  }
}