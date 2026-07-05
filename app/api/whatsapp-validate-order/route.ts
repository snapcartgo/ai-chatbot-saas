import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Meta Graph API helper function to reply back to the WhatsApp user
async function sendWhatsAppMessage(phone_number_id: string, toPhone: string, textBody: string) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  
  await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "text",
      text: { body: textBody },
    }),
  });
}

export async function POST(req: NextRequest) {
  console.log("===== HYBRID WHATSAPP ORDER VALIDATOR ROUTE (NO-MERCHANT-TABLE-FIX) =====");
  try {
    const body = await req.json();

    let customerPhone = "";
    let phone_number_id = "";
    let itemsToValidate: any[] = [];
    
    // Parse the user_id from query parameters (fallback for webhooks) or request body properties
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id") || body.user_id || body.request_user_id || process.env.DEFAULT_USER_ID;

    // Check if payload is a Raw Meta Webhook vs Processed n8n JSON
    const isRawWebhook = !!body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (isRawWebhook) {
      const entry = body.entry[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (!message || message.type !== "order") {
        return NextResponse.json({ success: true, message: "Ignored non-order payload type." });
      }

      customerPhone = message.from;
      phone_number_id = change?.metadata?.phone_number_id; 
      const rawItems = message.order?.product_items || [];
      
      // Map catalog items to standard validation array
      itemsToValidate = rawItems.map((item: any) => ({
        product_name: item.product_retailer_id,
        quantity: Number(item.quantity),
        selected_attributes: {}
      }));
    } else {
      customerPhone = body.customerPhone || body.from;
      phone_number_id = body.phone_number_id || body.whatsapp_phone_number_id;
      itemsToValidate = body.items || [];
    }

    // Static analysis input guardrail to block path-traversal/SSRF attacks instantly
    if (!phone_number_id || !/^\d+$/.test(phone_number_id)) {
      return NextResponse.json({ success: false, message: "Invalid payload format." }, { status: 400 });
    }

    if (!customerPhone || itemsToValidate.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required contact metadata or items." }, { status: 400 });
    }

    // Since the merchants table does not exist, use the validated phone_number_id directly!
    const trusted_phone_id = phone_number_id;

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    const missingProducts: any[] = [];

    for (const item of itemsToValidate) {
      const product_name = item.product_name;
      const requestedQuantity = Number(item.quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        continue;
      }

      let search = product_name.trim().toLowerCase();
      if (search === "tshirt" || search === "t shirt" || search === "shirt") {
        search = "t-shirt";
      }

      // Build product lookup query (Scope to user_id if available, otherwise search globally)
      let productQuery = supabase.from("products").select("*");
      if (user_id) {
        productQuery = productQuery.eq("user_id", user_id);
      }
      productQuery = productQuery.or(`sku.ilike.%${search}%,name.ilike.%${search}%,category.ilike.%${search}%`);

      let { data: products, error: productError } = await productQuery;

      if (productError || !products || products.length === 0) {
        missingProducts.push({
          product_name: product_name,
          error_type: "not_found"
        });
        continue;
      }

      const product = products[0];
      const unitPrice = Number(product.price);

      if (requestedQuantity > Number(product.stock)) {
        await sendWhatsAppMessage(
          trusted_phone_id,
          customerPhone,
          `⚠️ Order Alert: Only ${product.stock} units left in stock for "${product.name}". Please adjust your checkout cart count.`
        );
        return NextResponse.json({ success: false, message: `Only ${product.stock} units left.` });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 40;
      
      grandSubtotal += subtotal;
      grandShipping += shipping;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        subtotal,
      });
    }

    if (missingProducts.length > 0) {
      const failedNames = missingProducts.map(p => `"${p.product_name}"`).join(", ");
      const alertMsg = `❌ Sorry, the following item(s): ${failedNames} are out of stock or could not be found. Please open the shop catalogs drawer and select an alternative option.`;
      
      await sendWhatsAppMessage(trusted_phone_id, customerPhone, alertMsg);
      return NextResponse.json({ success: false, message: alertMsg });
    }

    const checkoutSummary = 
      `🛍️ *Order Confirmation Receipt Summary* \n` +
      `---------------------------------\n` +
      validatedItems.map(i => `• ${i.product_name} (x${i.quantity}) - ₹${i.subtotal}`).join("\n") +
      `\n---------------------------------\n` +
      `Subtotal: ₹${grandSubtotal}\n` +
      `Delivery/Shipping Fee: ₹${grandShipping}\n` +
      `*Grand Total Amount: ₹${grandSubtotal + grandShipping}*\n\n` +
      `✅ Items are locked. Kindly text us back with your *Full Name, Delivery Address, and Email* to finalise dispatch routing details.`;

    await sendWhatsAppMessage(trusted_phone_id, customerPhone, checkoutSummary);
    
    return NextResponse.json({ 
      success: true, 
      message: "Order successfully verified.",
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping
    });

  } catch (err: any) {
    console.error("Critical Exception processing WhatsApp pipeline: ", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}