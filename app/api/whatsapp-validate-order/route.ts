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

// Normalized item shape used internally after parsing either payload type
interface NormalizedItem {
  quantity: number;
  selected_attributes: Record<string, any>;
  // Exactly ONE of these two will be set depending on source
  catalog_id?: string;   // from WhatsApp catalog (product_retailer_id) -> EXACT match
  product_name?: string; // from CSV/manual entry -> FUZZY match (old logic)
}

export async function POST(req: NextRequest) {
  console.log("===== HYBRID WHATSAPP ORDER VALIDATOR ROUTE (v6 - catalog id fix) =====");
  try {
    const body = await req.json();

    let customerPhone = "";
    let phone_number_id = "";
    let itemsToValidate: NormalizedItem[] = [];
    const request_user_id = body.user_id;

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

      // IMPORTANT: product_retailer_id is the exact catalog SKU set in Meta Commerce Manager.
      // This is NOT free text, so it must NOT go through fuzzy name search.
      itemsToValidate = rawItems.map((item: any) => ({
        catalog_id: String(item.product_retailer_id || "").trim(),
        quantity: Number(item.quantity),
        selected_attributes: {},
      }));
    } else {
      customerPhone = body.customerPhone || body.from;
      phone_number_id = body.phone_number_id || body.whatsapp_phone_number_id;

      // CSV / manual / n8n text-entry path keeps the old fuzzy-name behaviour
      itemsToValidate = (body.items || []).map((item: any) => ({
        product_name: item.product_name,
        quantity: Number(item.quantity),
        selected_attributes: item.selected_attributes || {},
      }));
    }

    // Static analysis input guardrail to block path-traversal attacks instantly
    if (!phone_number_id || !/^\d+$/.test(phone_number_id)) {
      return NextResponse.json({ success: false, message: "Invalid payload format." }, { status: 400 });
    }

    if (!customerPhone || itemsToValidate.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required contact metadata or items." }, { status: 400 });
    }

    // Query the correct table "whatsapp_configs" instead of "merchants"
    let merchantQuery = supabase.from("whatsapp_configs").select("user_id, wa_phone_number_id");

    if (isRawWebhook) {
      merchantQuery = merchantQuery.eq("wa_phone_number_id", phone_number_id);
    } else if (request_user_id) {
      merchantQuery = merchantQuery.eq("user_id", request_user_id);
    } else {
      merchantQuery = merchantQuery.eq("wa_phone_number_id", phone_number_id);
    }

    const { data: merchant, error: merchantError } = await merchantQuery.single();

    if (merchantError || !merchant?.user_id) {
      console.error("Merchant mapping error:", merchantError);
      return NextResponse.json({ success: false, message: "Unknown merchant metadata." }, { status: 400 });
    }

    // Map the correct trusted ID key
    const trusted_phone_id = merchant.wa_phone_number_id || phone_number_id;
    const user_id = merchant.user_id;

    // Define the dynamic shipping threshold constants parsed from the knowledge base profile
    const baseShippingFee = Number((merchant as any)?.shipping_fee ?? 40);
    const freeShippingMin = Number((merchant as any)?.free_shipping_threshold ?? 999);

    const sendSMSFlag = body.send_sms !== undefined ? String(body.send_sms) !== "false" : true;
    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    const missingProducts: any[] = [];

    for (const item of itemsToValidate) {
      const requestedQuantity = Number(item.quantity);

      if (Number.isNaN(requestedQuantity) || requestedQuantity <= 0) {
        continue;
      }

      let products: any[] | null = null;
      let productError: any = null;
      let lookupLabel = "";

      if (item.catalog_id) {
        // ---- CATALOG PATH: exact match on SKU / catalog id ----
        lookupLabel = item.catalog_id;
        const result = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user_id)
          .eq("sku", item.catalog_id) // exact match, no ILIKE wildcard
          .limit(1);
        products = result.data;
        productError = result.error;
      } else if (item.product_name) {
        // ---- CSV / MANUAL PATH: fuzzy match (unchanged legacy logic) ----
        let search = item.product_name.trim().toLowerCase();
        lookupLabel = item.product_name;
        if (search === "tshirt" || search === "t shirt" || search === "shirt") {
          search = "t-shirt";
        }

        const result = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user_id)
          .or(`sku.ilike.%${search}%,name.ilike.%${search}%,category.ilike.%${search}%`);
        products = result.data;
        productError = result.error;
      } else {
        continue;
      }

      if (productError || !products || products.length === 0) {
        missingProducts.push({
          product_name: lookupLabel,
          error_type: "not_found",
        });
        continue;
      }
      
      // 1. Grab the matched base product
      const product = products[0];
      const unitPrice = Number(product.price);

      // 2. Extract variant attributes if they exist
      const requiredFields: string[] = Array.isArray(product.required_fields) 
        ? product.required_fields 
        : typeof product.required_fields === "string" 
          ? JSON.parse(product.required_fields) 
          : [];

      // 3. Check if the incoming request already has these selections (Normalized to lowercase keys)
      const incomingAttributes = item.selected_attributes || {};
      const normalizedAttributes = Object.fromEntries(
        Object.entries(incomingAttributes).map(([key, val]) => [key.toLowerCase(), val])
      );

      const missingAttributes = requiredFields.filter(field => !normalizedAttributes[field.toLowerCase()]);

      // 4. If fields are missing, stop checkout and ask the user for them!
      if (missingAttributes.length > 0) {
        const optionsMessage = `👕 *Select Options for ${product.name}*\n\n` +
          `To proceed with your checkout order, please reply specifying your preferred:\n` +
          missingAttributes.map(attr => `• *${attr.toUpperCase()}*`).join("\n") + 
          `\n\n_Example reply: "Tshirt size M color black"_`;

        await sendWhatsAppMessage(trusted_phone_id, customerPhone, optionsMessage);
        return NextResponse.json({ success: false, message: `Awaiting product attributes: ${missingAttributes.join(", ")}` });
      }

      // 5. Run the requested warehouse safety margin stock check
      if (requestedQuantity > Number(product.stock)) {
        await sendWhatsAppMessage(
          trusted_phone_id,
          customerPhone,
          `  Order Alert: Only ${product.stock} units left in stock for "${product.name}". Please adjust your checkout cart count.`
        );
        return NextResponse.json({ success: false, message: `Only ${product.stock} units left.` });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= freeShippingMin ? 0 : baseShippingFee;

      grandSubtotal += subtotal;
      grandShipping += shipping;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        subtotal,
      });
    } // Ends the item validation traversal loop cleanly

    if (missingProducts.length > 0) {
      const failedNames = missingProducts.map((p) => `${p.product_name}`).join(", ");
      const alertMsg = `  Sorry, the following item(s): ${failedNames} are out of stock or could not be found. Please open the shop catalogs drawer and select an alternative option.`;

      await sendWhatsAppMessage(trusted_phone_id, customerPhone, alertMsg);
      return NextResponse.json({ success: false, message: alertMsg });
    }

    // Wrap this whole block inside an IF check so it stays silent when n8n runs it
    if (sendSMSFlag) {
      const checkoutSummary =
        `  *Order Confirmation Receipt Summary*\n` +
        `---------------------------------\n` +
        validatedItems.map((i) => `• ${i.product_name} (x${i.quantity}) - ₹${i.subtotal}`).join("\n") +
        `\n---------------------------------\n` +
        `Subtotal: ₹${grandSubtotal}\n` +
        `Delivery/Shipping Fee: ₹${grandShipping}\n` +
        `*Grand Total Amount: ₹${grandSubtotal + grandShipping}*\n\n` +
        `  Items are locked. Kindly text us back with your *Full Name, Delivery Address, phone number and Email* to finalise dispatch routing details.`;

      await sendWhatsAppMessage(trusted_phone_id, customerPhone, checkoutSummary);
    }

    // This return block stays completely outside the if condition so n8n still receives the total prices!
    return NextResponse.json({
      success: true,
      message: "Order successfully verified.",
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping,
    });
  } catch (err: any) {
    console.error("Critical Exception processing WhatsApp pipeline: ", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}