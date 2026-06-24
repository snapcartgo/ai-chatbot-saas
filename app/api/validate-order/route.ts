import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
      const requestedQuantity = Number(quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        return NextResponse.json({ success: false, message: `Invalid quantity for ${product_name || "product"}.` }, { status: 400 });
      }

      // 1. Fetch Product
      const { data: products, error } = await supabase
        .from("products")
        .select("*")
        .ilike("name", product_name.trim()); 

      if (error || !products || products.length === 0) {
        return NextResponse.json({ success: false, message: `Product not found: ${product_name}` });
      }

      const product = products[0];
      const productAttributes = product.attributes || {}; // This is your JSONB object

      // 2. Dynamic Attribute Validation
      // We check: Did the user provide everything needed? Are their choices valid?
      const missingFields = [];
      const invalidFields = [];

      for (const key in productAttributes) {
        // If product has this key, it is considered "required"
        if (!selected_attributes[key]) {
          missingFields.push(key);
        } else if (!productAttributes[key].includes(selected_attributes[key])) {
          // If the user picked a value (like "Pink") that isn't in the list ["Red", "Blue"]
          invalidFields.push(key);
        }
      }

      if (missingFields.length > 0) {
        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_fields: missingFields,
          available_options: productAttributes, // Send this to chatbot to show user
          message: `Please select: ${missingFields.join(", ")}`,
        });
      }

      if (invalidFields.length > 0) {
        return NextResponse.json({
          success: false,
          message: `Invalid selection for: ${invalidFields.join(", ")}. Please check available options.`,
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

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes,
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