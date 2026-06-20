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

const requestId = crypto.randomUUID();

console.log(`[${requestId}] validate-order`, {
  product_name,
  color,
  size,
  quantity,
});

console.log("validate-order", {
  product_name,
  color,
  size,
  quantity,
});

const requestedQuantity = Number(quantity);

if (!product_name || requestedQuantity <= 0 || Number.isNaN(requestedQuantity)) {
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

    const { data: products, error } = await query.limit(1);

const product = products?.[0];

if (error || !product) {
  return NextResponse.json({
    success: false,
    message: "Product not found."
  });
}

    const stock = Number(product.stock);
    const unitPrice = Number(product.price);

    // Shipping rule
    const shipping = unitPrice * requestedQuantity >= 999 ? 0 : 1;

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

      message: "Stock available. Kindly share Your Name, Email and Phone Number.",
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