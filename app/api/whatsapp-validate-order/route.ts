import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendWhatsAppMessage(
  phone_number_id: string,
  toPhone: string,
  textBody: string
) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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

interface NormalizedItem {
  quantity: number;
  selected_attributes: Record<string, any>;
  catalog_id?: string;   // Meta exact catalog ID match
  product_name?: string; // Fuzzy name fallback match
}

export async function POST(req: NextRequest) {
  console.log("===== HYBRID WHATSAPP ORDER VALIDATOR ROUTE (Meta Catalog Fix) =====");
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

      itemsToValidate = rawItems.map((item: any) => ({
        catalog_id: String(item.product_retailer_id || "").trim(),
        quantity: Number(item.quantity),
        selected_attributes: {},
      }));
    } else {
      customerPhone = body.customerPhone || body.from;
      phone_number_id = body.phone_number_id || body.whatsapp_phone_number_id;

      itemsToValidate = (body.items || []).map((item: any) => ({
        product_name: item.product_name,
        quantity: Number(item.quantity),
        selected_attributes: item.selected_attributes || {},
      }));
    }

    if (!phone_number_id || !/^\d+$/.test(phone_number_id)) {
      return NextResponse.json({ success: false, message: "Invalid payload format." }, { status: 400 });
    }

    if (!customerPhone || itemsToValidate.length === 0) {
      return NextResponse.json({ success: false, message: "Missing required contact metadata or items." }, { status: 400 });
    }

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

    const trusted_phone_id = merchant.wa_phone_number_id || phone_number_id;
    const user_id = merchant.user_id;

    const baseShippingFee = Number((merchant as any)?.YOUR_EXACT_COLUMN_NAME ?? 40);
    const freeShippingMin = Number((merchant as any)?.free_shipping_threshold ?? 999);

    const sendSMSFlag = body.send_sms !== undefined ? String(body.send_sms) !== "false" : true;
    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;
    const missingProducts: any[] = [];

    for (const item of itemsToValidate) {
      const requestedQuantity = Number(item.quantity);
      if (Number.isNaN(requestedQuantity) || requestedQuantity <= 0) continue;

      let products: any[] | null = null;
      let productError: any = null;
      let lookupLabel = "";

      // ---- STEP 1: ATTEMPT LOCAL DATABASE LOOKUP ----
      if (item.catalog_id) {
        lookupLabel = item.catalog_id;
        const result = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user_id)
          .or(`retailer_id.eq.${item.catalog_id},sku.eq.${item.catalog_id}`)
          .limit(1);
        products = result.data;
        productError = result.error;
      } else if (item.product_name) {
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
      }

      
      // ---- STEP 2: DYNAMIC META CATALOG FETCH (FIXED PARAMETERS & PARSING) ----
      if (false && (productError || !products || products.length === 0)) {
        const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const CATALOG_ID =
  req.headers.get("x-catalog-id") ||
  (merchant as any)?.meta_catalog_id ||
  "4719947504907117";

console.log("========== META DEBUG ==========");
console.log("Catalog ID:", CATALOG_ID);
console.log("Token Prefix:", WHATSAPP_TOKEN?.substring(0, 20));
console.log("Merchant:", merchant);

        if (WHATSAPP_TOKEN) {
  try {

    console.log("========== Entering Meta catalog lookup ==========");

    const metaUrl =
  `https://graph.facebook.com/v20.0/${CATALOG_ID}/products` +
  `?fields=product_id,name,retailer_id,price,image_url,color,description,url,availability` +
  `&access_token=${WHATSAPP_TOKEN}`;

console.log("Meta URL:", metaUrl);
console.log("Catalog ID:", CATALOG_ID);
console.log("Token Prefix:", WHATSAPP_TOKEN?.substring(0, 40));
console.log("Meta URL:", metaUrl);
const metaRes = await fetch(metaUrl);

    console.log("Meta Status:", metaRes.status);

    const metaData = await metaRes.json();
    if (!metaRes.ok) {
  throw new Error(metaData.error?.message || "Meta Catalog API failed.");
}

    console.log("Meta Response:", JSON.stringify(metaData, null, 2));


            console.log("Meta URL:", metaUrl);
            console.log("Meta Response:", JSON.stringify(metaData, null, 2));
            console.log("========== META RESPONSE ==========");
              console.log(JSON.stringify(metaData, null, 2));

            if (metaData && metaData.data && metaData.data.length > 0) {
              let matchedMetaItem = null;

              if (item.catalog_id) {
                matchedMetaItem = metaData.data.find((m: any) => 
                  String(m.retailer_id).trim().toLowerCase() === String(item.catalog_id).trim().toLowerCase()
                );
              } else if (item.product_name) {
                const searchStr = item.product_name.toLowerCase().trim();
                matchedMetaItem = metaData.data.find((m: any) => 
                  m.name.toLowerCase().includes(searchStr)
                );
              }

              if (matchedMetaItem) {
                const isAvailable = matchedMetaItem.availability === "in stock" || matchedMetaItem.availability === "available";
                
                // FIXED: Correctly reference matchedMetaItem instead of metaData.data[0]
                let rawPrice = 0;
                if (matchedMetaItem.price && typeof matchedMetaItem.price === 'object') {
                  rawPrice = parseFloat(matchedMetaItem.price.amount || '0') || 0;
                } else if (matchedMetaItem.price) {
                  rawPrice = parseFloat(String(matchedMetaItem.price).replace(/[^0-9.]/g, '')) || 0;
                }

                products = [{
                  id: matchedMetaItem.id,
                  name: matchedMetaItem.name,
                  price: rawPrice,
                  stock: isAvailable ? 999 : 0,
                  required_fields: []
                }];
              }
            } else if (metaData.error) {
              console.error("Meta API Error Details:", metaData.error);
            }
          } catch (metaErr) {
            console.error("===== META FETCH ERROR =====");
            console.error(metaErr);
          }
        }
      }

      // ---- STEP 3: RUN VALIDATIONS AND CALCULATE totals ----
      if (!products || products.length === 0) {
        missingProducts.push({ product_name: lookupLabel, error_type: "not_found" });
        continue;
      }
      
      const product = products[0];
      const unitPrice = Number(product.price);

      // (Keep your existing variant attribute validations down below here intact...)

      const requiredFields: string[] = Array.isArray(product.required_fields) 
        ? product.required_fields 
        : typeof product.required_fields === "string" 
          ? JSON.parse(product.required_fields) 
          : [];

      const incomingAttributes = item.selected_attributes || {};
      const normalizedAttributes = Object.fromEntries(
        Object.entries(incomingAttributes).map(([key, val]) => [key.toLowerCase(), val])
      );
      const missingAttributes = requiredFields.filter(field => !normalizedAttributes[field.toLowerCase()]);

      if (missingAttributes.length > 0 && !isRawWebhook) {
        const optionsMessage = `👕 *Select Options for ${product.name}*\n\n` +
          `To proceed with your checkout order, please reply specifying your preferred:\n` +
          missingAttributes.map(attr => `• *${attr.toUpperCase()}*`).join("\n") + 
          `\n\n_Example reply: "Tshirt size M color black"_`;

        await sendWhatsAppMessage(trusted_phone_id, customerPhone, optionsMessage);
        return NextResponse.json({ success: false, message: `Awaiting product attributes: ${missingAttributes.join(", ")}` });
      }

      if (requestedQuantity > Number(product.stock)) {
        await sendWhatsAppMessage(
          trusted_phone_id,
          customerPhone,
          `Order Alert: Only ${product.stock} units left in stock for "${product.name}". Please adjust your cart count.`
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
    }

    if (missingProducts.length > 0) {
      const failedNames = missingProducts.map((p) => `${p.product_name}`).join(", ");
      const alertMsg = `the following item(s): ${failedNames} are out of stock or could not be found. Please open the shop catalogs drawer and select an alternative option.`;
      await sendWhatsAppMessage(trusted_phone_id, customerPhone, alertMsg);
      return NextResponse.json({ success: false, message: alertMsg });
    }

    if (sendSMSFlag) {
      const checkoutSummary =
        `*Order Confirmation Receipt Summary*\n` +
        `---------------------------------\n` +
        validatedItems.map((i) => `• ${i.product_name} (x${i.quantity}) - ₹${i.subtotal}`).join("\n") +
        `\n---------------------------------\n` +
        `Subtotal: ₹${grandSubtotal}\n` +
        `Delivery/Shipping Fee: ₹${grandShipping}\n` +
        `*Grand Total Amount: ₹${grandSubtotal + grandShipping}*\n\n` +
        `Items are locked. Kindly text us back with your *Full Name, Delivery Address, phone number and Email* to finalise dispatch routing details.`;

      await sendWhatsAppMessage(trusted_phone_id, customerPhone, checkoutSummary);
    }

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