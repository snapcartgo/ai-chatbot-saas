import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    // 1. Fetch Product and Check Attributes
    for (const item of items) {
      const { product_name, selected_attributes = {} } = item;
      
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .ilike("name", product_name.trim());

      if (!products || products.length === 0) {
        return NextResponse.json({ success: false, message: `Product not found: ${product_name}` });
      }

      const product = products[0];
      const requiredAttributes = Object.keys(product.attributes || {}); 
      
      // Check for missing attributes (e.g., color, size)
      for (const attr of requiredAttributes) {
        if (!selected_attributes[attr]) {
          return NextResponse.json({
            success: false,
            message: `Please specify the ${attr} for ${product.name}. Available options: ${product.attributes[attr].join(", ")}`
          });
        }
      }
    }

    // 2. If we reach here, all attributes are present. Save directly.
    const { error: upsertError } = await supabase
      .from("cart_sessions")
      .upsert({
        session_id: session_id,
        selected_attributes: items[0].selected_attributes,
        current_step: "collecting_user_details",
        updated_at: new Date().toISOString(),
      }, { onConflict: 'session_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({
      success: true,
      message: "Order details confirmed. Kindly share your Name, Email, and Phone Number."
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || "Error." }, { status: 500 });
  }
}