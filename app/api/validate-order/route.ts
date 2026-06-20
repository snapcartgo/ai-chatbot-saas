import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      product_name,
      quantity,
      color,
      size,
    } = body;

    // Generate unique request ID for debugging
    const requestId = crypto.randomUUID();

    console.log(`[${requestId}] Incoming validate-order request`, {
      product_name,
      color,
      size,
      quantity,
    });

    const requestedQuantity = Number(quantity);

    if (
      !product_name ||
      requestedQuantity <= 0 ||
      Number.isNaN(requestedQuantity)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product or quantity.",
        },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from("products")
      .select("*")
      .ilike("name", product_name);

    if (color) {
      query = query.eq("color", color);
    }

    if (size) {
      query = query.eq("size", size);
    }

    // Safer than .single()
    const { data: product, error } = await query.maybeSingle();

    console.log(`[${requestId}] Query result`, {
      found: !!product,
      error: error?.message || null,
      matchedProduct: product?.name || null,
    });

    if (error || !product) {
      return NextResponse.json({
        success: false,
        message: "Sorry, the selected size or color is currently unavailable for this product. Please choose a different size or color, and I'll be happy to help you.",
      });
    }

    const stock = Number(product.stock);
    const unitPrice = Number(product.price);

    const shipping =
      unitPrice * requestedQuantity >= 999 ? 0 : 1;

    if (requestedQuantity > stock) {
      return NextResponse.json({
        success: false,
        stock_ok: false,
        available_stock: stock,
        message: `Sorry, only ${stock} item(s) are available in stock.`,
      });
    }

    const subtotal = unitPrice * requestedQuantity;
    const total = subtotal + shipping;

    console.log(`[${requestId}] Validation successful`, {
      product: product.name,
      stock,
      subtotal,
      shipping,
      total,
    });

    return NextResponse.json({
      success: true,
      stock_ok: true,

      product_id: product.product_id,
      product_name: product.name,

      requested_quantity: requestedQuantity,
      available_stock: stock,

      unit_price: unitPrice,
      subtotal,
      shipping,
      total,

      message:
        "Stock available. Kindly share your Name, Email and Phone Number.",
    });
  } catch (err: any) {
    console.error("validate-order unexpected error:", err);

    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}