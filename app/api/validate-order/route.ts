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
      requested_quantity,
      color,
      size,
    } = body;

    const quantity = Number(requested_quantity);

    if (!product_name || !quantity || quantity <= 0) {
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
      .eq("name", product_name);

    if (color) {
      query = query.eq("color", color);
    }

    if (size) {
      query = query.eq("size", size);
    }

    const { data: product, error } = await query.single();

    if (error || !product) {
      return NextResponse.json(
        {
          success: false,
          message: "Product not found.",
        },
        { status: 404 }
      );
    }

    const stock = Number(product.stock);
    const unitPrice = Number(product.price);

    // Shipping rule
    const shipping = unitPrice * quantity >= 999 ? 0 : 1;

    // Validate stock
    if (quantity > stock) {
      return NextResponse.json({
        success: false,
        stock_ok: false,
        available_stock: stock,
        message: `Sorry, only ${stock} item(s) are available in stock.`,
      });
    }

    // Calculate totals
    const subtotal = unitPrice * quantity;
    const total = subtotal + shipping;

    return NextResponse.json({
      success: true,
      stock_ok: true,

      product_id: product.product_id,
      product_name: product.name,

      requested_quantity: quantity,
      available_stock: stock,

      unit_price: unitPrice,
      subtotal,
      shipping,
      total,

      message: "Stock available. Proceed with order.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || "Internal server error.",
      },
      { status: 500 }
    );
  }
}