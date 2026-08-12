import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const status = formData.get("status");
    const txnid = formData.get("txnid") as string;
    const payment_id = formData.get("mihpayid") as string;

    console.log("PAYU RESPONSE RECVD:", { status, txnid, payment_id });

    if (status === "success" && txnid) {
      // 1. Fetch order details from Supabase
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", txnid)
        .single();

      if (orderError || !order) {
        console.error("Order fetch error:", orderError);
      } else {
        console.log("FOUND ORDER:", { id: order.id, product_name: order.product_name, user_id: order.user_id });

        const rawProductName = order.product_name || "";

        if (rawProductName) {
          // Split multiple product names if comma separated
          const productTitles = rawProductName
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);

          for (const title of productTitles) {
            let query = supabase
              .from("products")
              .select("product_id, name, stock, sold_count");

            // Filter by product title
            query = query.ilike("name", `%${title}%`);

            if (order.user_id) {
              query = query.eq("user_id", order.user_id);
            }

            const { data: matchedProducts, error: prodErr } = await query;

            if (prodErr) {
              console.error("Product lookup error:", prodErr);
              continue;
            }

            if (matchedProducts && matchedProducts.length > 0) {
              const product = matchedProducts[0];

              const currentStock = parseInt(String(product.stock ?? "999"), 10);
              const currentSold = Number(product.sold_count ?? 0);

              const newStock = Math.max(0, currentStock - 1);
              const newSold = currentSold + 1;

              console.log(`UPDATING PRODUCT [${product.name}]: Stock ${currentStock} -> ${newStock}, Sold ${currentSold} -> ${newSold}`);

              const { error: updateErr } = await supabase
                .from("products")
                .update({
                  stock: String(newStock),
                  sold_count: newSold,
                })
                .eq("product_id", product.product_id);

              if (updateErr) {
                console.error("Failed updating product stock:", updateErr);
              } else {
                console.log("STOCK UPDATED SUCCESSFULLY!");
              }
            } else {
              console.warn(`No product match found for title: "${title}"`);
            }
          }
        }

        // 3. Mark payment status as paid
        await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            payment_id: payment_id,
          })
          .eq("id", txnid);
      }
    }

    const url = new URL(
      `/order-success?order_id=${txnid}`,
      "https://ai-chatbot-saas-five.vercel.app"
    );

    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("Error in PayU success:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}