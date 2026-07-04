import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Meta Graph API helper function to reply back to the WhatsApp user
async function sendWhatsAppMessage(phone_number_id: string, toPhone: string, textBody: string) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN; // Ensure this is saved in your env parameters
  
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
  console.log("===== WHATSAPP APPS PRODUCTION ORDER VALIDATOR =====");
  try {
    const body = await req.json();

    // 1. WhatsApp Webhook Extraction Guardrail
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    // If it's a routine webhook status check or not an order message, exit early
    if (!message || message.type !== "order") {
      return NextResponse.json({ success: true, message: "Ignored non-order payload type." });
    }

    const customerPhone = message.from;
    const phone_number_id = change?.metadata?.phone_number_id; 
    const orderData = message.order;
    const catalogId = orderData.catalog_id;
    const rawItems = orderData.product_items || []; // Array containing retail ids and quantities

    // 2. Fetch Merchant profile by tracking who owns this phone_number_id or catalogId
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants") // Assuming you keep a connection mapper table named 'merchants'
      .select("user_id")
      .eq("whatsapp_phone_number_id", phone_number_id)
      .single();

    if (merchantError || !merchant?.user_id) {
      console.error("Merchant mapping error:", merchantError);
      return NextResponse.json({ success: false, message: "Unknown merchant metadata." }, { status: 400 });
    }

    const user_id = merchant.user_id;
    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    const missingProducts: any[] = [];

    // 3. Process the WhatsApp Cart Items list
    for (const item of rawItems) {
      const product_retailer_id = item.product_retailer_id; // The SKU name inside your Meta Catalog dashboard
      const requestedQuantity = Number(item.quantity);

      if (!product_retailer_id || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        continue;
      }

      // Convert your text variations mapping strategies directly to lookups
      let search = product_retailer_id.trim().toLowerCase();
      if (search === "tshirt" || search === "t shirt" || search === "shirt") {
        search = "t-shirt";
      }

      // Primary Fuzzy Search (Strictly scoped to user_id context derived from the specific phone account match)
      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id)
        .or(`sku.ilike.%${search}%,name.ilike.%${search}%,category.ilike.%${search}%`);

      // Fallback matching lookup routines
      if (productError || !products || products.length === 0) {
        missingProducts.push({
          product_name: product_retailer_id,
          error_type: "not_found"
        });
        continue;
      }

      const product = products[0];
      const unitPrice = Number(product.price);

      // Stock level verification guardrails
      if (requestedQuantity > Number(product.stock)) {
        await sendWhatsAppMessage(
          phone_number_id,
          customerPhone,
          `⚠️ Order Alert: Only ${product.stock} units left in stock for "${product.name}". Please adjust your checkout cart count.`
        );
        return NextResponse.json({ success: true });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 40; // Standard shipping fallback calculation value
      
      grandSubtotal += subtotal;
      grandShipping += shipping;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        subtotal,
      });
    }

    // 4. Send structured message notifications back to the customer's phone line
    if (missingProducts.length > 0) {
      const failedNames = missingProducts.map(p => `"${p.product_name}"`).join(", ");
      const alertMsg = `❌ Sorry, the following item(s): ${failedNames} are out of stock or could not be found in our core store inventory index. Please open the shop catalogs drawer and select an alternative product option.`;
      
      await sendWhatsAppMessage(phone_number_id, customerPhone, alertMsg);
      return NextResponse.json({ success: true });
    }

    // Success Sequence block execution
    const checkoutSummary = 
      `🛍️ *Order Confirmation Receipt Summary* \n` +
      `---------------------------------\n` +
      validatedItems.map(i => `• ${i.product_name} (x${i.quantity}) - ₹${i.subtotal}`).join("\n") +
      `\n---------------------------------\n` +
      `Subtotal: ₹${grandSubtotal}\n` +
      `Delivery/Shipping Fee: ₹${grandShipping}\n` +
      `*Grand Total Amount: ₹${grandSubtotal + grandShipping}*\n\n` +
      `✅ Items are locked. Kindly text us back with your *Full Name, Delivery Address, and Email* to finalise dispatch routing details.`;

    await sendWhatsAppMessage(phone_number_id, customerPhone, checkoutSummary);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Critical Exception processing WhatsApp pipeline: ", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}