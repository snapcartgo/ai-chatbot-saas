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
      return NextResponse.json(
        {
          success: false,
          message: "No products provided.",
        },
        { status: 400 }
      );
    }

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    let grandTotal = 0;

    for (const item of items) {
      const {
        product_name,
        color,
        size,
        quantity,
      } = item;

      const requestedQuantity = Number(quantity);

      if (
        !product_name ||
        Number.isNaN(requestedQuantity) ||
        requestedQuantity <= 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid quantity for ${product_name || "product"}.`,
          },
          { status: 400 }
        );
      }

      let query = supabase
        .from("products")
        .select("*")
        .ilike("name", `%${product_name}%`);

      if (color) {
        query = query.eq("color", color);
      }

      if (size) {
        query = query.eq("size", size);
      }

      const { data: product, error } = await query.maybeSingle();

      if (error || !product) {
        return NextResponse.json({
          success: false,
          message: `Product not found: ${product_name} (${color || "-"} / ${size || "-"})`,
        });
      }

      const stock = Number(product.stock);
      const unitPrice = Number(product.price);

      if (requestedQuantity > stock) {
        return NextResponse.json({
          success: false,
          message: `Only ${stock} item(s) available for ${product.name}.`,
        });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 1;
      const total = subtotal + shipping;

      grandSubtotal += subtotal;
      grandShipping += shipping;
      grandTotal += total;

      validatedItems.push({
        product_id: product.product_id,
        product_name: product.name,
        color,
        size,
        quantity: requestedQuantity,
        unit_price: unitPrice,
        subtotal,
        shipping,
        total,
      });
    }

    return NextResponse.json({
      success: true,
      stock_ok: true,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandTotal,
      message:
        "All products are available. Kindly share your Name, Email and Phone Number.",
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