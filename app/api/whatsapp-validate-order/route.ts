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
  console.log("===== HYBRID RESILIENT WHATSAPP ORDER VALIDATOR ROUTE =====");
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

    const trusted_phone_id = phone_number_id;
    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    const missingProducts: any[] = [];

    // Fetch all products for this user once to perform extremely resilient bidirectional matching in memory
    let { data: allProducts, error: allProductsError } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", user_id);

    if (allProductsError || !allProducts) {
      console.error("Supabase query error or empty products catalogue table:", allProductsError);
      allProducts = [];
    }

    for (const item of itemsToValidate) {
      const product_name = item.product_name as string;
      const requestedQuantity = Number(item.quantity);

      if (!product_name || Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        continue;
      }

      let search: string = product_name.trim().toLowerCase();
      if (search === "tshirt" || search === "t shirt" || search === "shirt") {
        search = "t-shirt";
      }

      // Bidirectional matching loop:
      // Case A: Database value contains our search term (e.g. database has "Premium Cotton T-Shirt" and search is "T-Shirt")
      // Case B: Our search term contains the database value (e.g. database has "T-Shirt" and search is "Premium Cotton T-Shirt")
      let matchedProducts = allProducts.filter((p: any) => {
        const dbName = (p.name || "").toLowerCase().trim();
        const dbSku = (p.sku || "").toLowerCase().trim();
        const dbCategory = (p.category || "").toLowerCase().trim();

        if (dbName.includes(search) || dbSku.includes(search) || dbCategory.includes(search)) {
          return true;
        }

        if (dbName.length > 2 && search.includes(dbName)) {
          return true;
        }
        if (dbSku.length > 2 && search.includes(dbSku)) {
          return true;
        }

        return false;
      });

      // Split-phrase keyword fallback matching with explicit parameter typing to clear 'noImplicitAny'
      if (matchedProducts.length === 0 && search.includes(" ")) {
        const words: string[] = search.split(" ").filter((w: string) => w.length > 2);
        matchedProducts = allProducts.filter((p: any) => {
          const dbName = (p.name || "").toLowerCase().trim();
          return words.some((word: string) => dbName.includes(word) || word.includes(dbName));
        });
      }

      if (matchedProducts.length === 0) {
        missingProducts.push({
          product_name: product_name,
          error_type: "not_found"
        });
        continue;
      }

      const product = matchedProducts[0];
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
      total: grandSubtotal + grandShipping,
      items: validatedItems,
      catalog_id: body.catalog_id || body.catalogId || null,
      phone_number_id: phone_number_id,
      customerPhone: customerPhone
    });

  } catch (err: any) {
    console.error("Critical Exception processing WhatsApp pipeline: ", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}