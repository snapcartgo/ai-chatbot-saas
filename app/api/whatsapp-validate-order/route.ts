// app/api/whatsapp-validate-order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Aggressive fuzzy normalization to match user inputs with store products
const normalizeProductName = (name: string) => {
  if (!name) return "";
  let clean = name.toLowerCase().trim();

  clean = clean
    .replace(/\b(premium|cotton|slim|fit|regular|mens|womens|casual|wireless|pro)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();

  if (clean.includes("shirt") || clean.includes("tshirt")) return "t-shirt";
  if (clean.includes("jean") || clean.includes("denim") || clean.includes("pant")) return "jeans";
  if (clean.includes("earbud") || clean.includes("airpod") || clean.includes("headphone") || clean.includes("audio")) return "earbud";
  
  return clean.replace(/s\b/g, "");
};

export async function POST(req: NextRequest) {
  console.log("===== WHATSAPP VALIDATE ORDER API PRODUCTION =====");
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (parseError) {
      console.log("Standard req.json() failed, trying raw text fallback...");
      try {
        const rawText = await req.text();
        if (rawText && rawText.trim()) {
          body = JSON.parse(rawText.trim());
        }
      } catch (jsonError) {
        console.error("Failed to parse raw body text:", jsonError);
        return NextResponse.json({ success: false, message: "Invalid JSON format payload." }, { status: 400 });
      }
    }

    const sessionId =
  body.session_id ||
  body.conversation_id ||
  body.chat_id ||
  body.customerPhone ||
  body.from ||
  null;

const items = body.items;
const user_id = body.user_id;
const isBuyIntent = body.intent === "buy" || !!body.customer_info;

console.log("--> Received sessionId:", sessionId);
console.log("--> Received user_id:", user_id);
console.log("--> Received items:", JSON.stringify(items));

if (!sessionId) {
  return NextResponse.json(
    { success: false, message: "Missing session_id or conversation_id context." },
    { status: 400 }
  );
}

    console.log("--> Received User ID:", user_id);
    console.log("--> Received Items array:", JSON.stringify(items));

    if (!user_id) {
      return NextResponse.json({ success: false, message: "Missing user_id context." }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "No products provided." }, { status: 400 });
    }

    const { data: existingCartRow, error: cartLookupError } = await supabase
      .from("cart_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .maybeSingle();

    console.log("--> Existing cart row found:", !!existingCartRow);

    if (cartLookupError) {
      console.error("Cart lookup error:", cartLookupError);
    }

    // ⏱️ SESSION EXPIRATION CHECK (30 Minutes / 1800000 ms)
    let isSessionExpired = false;
    if (existingCartRow?.updated_at) {
      const lastUpdated = new Date(existingCartRow.updated_at).getTime();
      const now = new Date().getTime();
      const diffMinutes = (now - lastUpdated) / (1000 * 60);

      if (diffMinutes > 30) {
        console.log(`--> Session ${sessionId} expired (${diffMinutes.toFixed(1)} mins old). Starting fresh.`);
        isSessionExpired = true;
      }
    }

    // Only load stored items if the session has NOT expired
    const storedCartItems: any[] = (!isSessionExpired && Array.isArray(existingCartRow?.cart_items))
      ? existingCartRow.cart_items
      : [];

    console.log("--> Existing cart row found:", !!existingCartRow);

    if (cartLookupError) {
      console.error("Cart lookup error:", cartLookupError);
    }

    

    let finalItemsToProcess: any[] = [];

    // Check if user is asking for NEW products or continuing an attribute selection flow
    if (Array.isArray(items) && items.length > 0) {
      const isCollectingAttributes = 
        !isBuyIntent && 
        existingCartRow && 
        storedCartItems.length > 0 && 
        existingCartRow.current_step === "collect_attributes";

      // Check if incoming items contain products NOT present in current stored cart
      const userMentionedNewProduct = items.some(incomingItem => {
        const incomingKey = normalizeProductName(incomingItem.product_name) || incomingItem.product_name;
        return !storedCartItems.some(dbItem => {
          const dbKey = normalizeProductName(dbItem.product_name) || dbItem.product_name;
          return dbKey === incomingKey;
        });
      });

      if (isCollectingAttributes && !userMentionedNewProduct) {
        // 🟡 User is answering attribute questions for existing items in cart
        const dbMap = new Map<string, any>();

        storedCartItems.forEach((dbItem: any) => {
          const key = normalizeProductName(dbItem.product_name) || dbItem.product_name;
          dbMap.set(key, { ...dbItem });
        });

        items.forEach((incomingItem: any) => {
          const incomingKey = normalizeProductName(incomingItem.product_name) || incomingItem.product_name;
          if (dbMap.has(incomingKey)) {
            const existing = dbMap.get(incomingKey);
            dbMap.set(incomingKey, {
              ...existing,
              quantity: incomingItem.quantity || existing.quantity || 1,
              selected_attributes: {
                ...(existing.selected_attributes || {}),
                ...(incomingItem.selected_attributes || {}),
              },
            });
          }
        });

        finalItemsToProcess = Array.from(dbMap.values());
      } else {
        // 🟢 User wants brand new products! Drop old cart memory (e.g., Adivasi Oil) completely.
        finalItemsToProcess = items.map((item: any) => ({ ...item }));
      }
    } else {
      finalItemsToProcess = storedCartItems;
    }
    
    const isMultiProductSession = finalItemsToProcess.length > 1;

    const validatedItems = [];
    let grandSubtotal = 0;
    let grandShipping = 0;

    const missingProducts: any[] = [];

    // Stage 1: Validate Every Product in finalItemsToProcess
    for (const item of finalItemsToProcess) {
      const { product_name, quantity, selected_attributes = {} } = item;
      const requestedQuantity = Number(quantity) || 1;

      if (!product_name) {
        return NextResponse.json({ success: false, message: `Invalid product name.` }, { status: 400 });
      }

      const cleanIncomingAttributes = Object.entries(selected_attributes || {}).reduce((acc: any, [k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          acc[k.toLowerCase().trim()] = String(v).trim();
        }
        return acc;
      }, {});

      let search = product_name.trim().toLowerCase();

      if (/^(tshirt|t-shirt|t shirt|shirt)s?$/i.test(search)) {
        search = "t-shirt";
      } else {
        search = search
          .replace(/\bt\s+shirts?\b/g, 't-shirt')
          .replace(/\btshirts?\b/g, 't-shirt')
          .replace(/s\b/g, '');
      }

      if (!cleanIncomingAttributes.color) {
        if (search.includes("black")) cleanIncomingAttributes.color = "black";
        else if (search.includes("white")) cleanIncomingAttributes.color = "white";
        else if (search.includes("blue")) cleanIncomingAttributes.color = "blue";
        else if (search.includes("red")) cleanIncomingAttributes.color = "red";
      }

      let { data: products, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user_id) 
        .eq("product_type", "meta")
        .or(`name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%`);

      if ((!products || products.length === 0) && search.includes(" ")) {
        const words = search.split(" ").filter(Boolean);
        let genericTerm = words[words.length - 1]; 
        
        if (/^(tshirt|t-shirt|t shirt|shirt)s?$/i.test(genericTerm)) {
          genericTerm = "t-shirt";
        }
        
        const { data: fallbackProducts } = await supabase
          .from("products")
          .select("*")
          .eq("user_id", user_id) 
          .eq("product_type", "meta")
          .or(`name.ilike.%${genericTerm}%,category.ilike.%${genericTerm}%`);
          
        if (fallbackProducts && fallbackProducts.length > 0) {
          products = fallbackProducts;
        }
      }

      // 🆕 ADD THIS CHECK: If user queried a broad category, return options in that category!
      if (products && products.length > 0) {
        const isCategorySearch = products.some((p: any) => 
          p.category && p.category.toLowerCase().trim() === search
        ) && !products.some((p: any) => 
          p.name && p.name.toLowerCase().trim() === search
        );

        if (isCategorySearch) {
          // Unique product names in this category
          const categoryProducts = Array.from(new Set(products.map((p: any) => p.name)));
          const productListStr = categoryProducts.map((name, i) => `${i + 1}. *${name}*`).join("\n");

          return NextResponse.json({
            success: false,
            requires_selection: true,
            message: `We have the following options available in the *${product_name}* category:\n\n${productListStr}\n\nPlease let us know which product you would like to order!`
          });
        }
      }

      if (productError || !products || products.length === 0) {
        missingProducts.push({
          product_name: product_name,
          error_type: "not_found"
        });
        continue; 
      }

      let product = null;
      let variantMatched = false;

      // Exact Variant Matching
      if (Object.keys(cleanIncomingAttributes).length > 0) {
        const matchedProduct = products.find((p: any) => {
          if (!p.attributes) return false;

          const dbAttributesNormalized = Object.entries(p.attributes).reduce((acc: any, [k, v]) => {
            acc[k.toLowerCase().trim()] = v;
            return acc;
          }, {});

          return Object.entries(cleanIncomingAttributes).every(([key, value]) => {
            const cleanKey = key.toLowerCase().trim();
            const targetVal = String(value).toLowerCase().trim();

            const dbValue1 = dbAttributesNormalized[cleanKey];
            const dbValue2 = dbAttributesNormalized[cleanKey === "color" ? "size" : "color"];

            if (!dbValue1) return false;

            const isMatchPrimary = Array.isArray(dbValue1)
              ? dbValue1.map(v => String(v).toLowerCase().trim()).includes(targetVal)
              : String(dbValue1).toLowerCase().trim() === targetVal;

            const isMatchSwapped = dbValue2 && (Array.isArray(dbValue2)
              ? dbValue2.map(v => String(v).toLowerCase().trim()).includes(targetVal)
              : String(dbValue2).toLowerCase().trim() === targetVal);

            return isMatchPrimary || isMatchSwapped;
          });
        });

        if (matchedProduct) {
          product = matchedProduct;
          variantMatched = true;
        }
      }

      if (!product) {
        product = products[0];
      }

      // Check 1: User specified an INVALID variant choice
      if (!variantMatched && !isBuyIntent && Object.keys(cleanIncomingAttributes).length > 0) {
        // Collect all available variants for this product search
        const availableVariants: Array<Record<string, string>> = [];

        products.forEach((p: any) => {
          if (p.attributes) {
            const variantObj: Record<string, string> = {};
            Object.entries(p.attributes).forEach(([k, v]) => {
              if (v !== null && v !== undefined && String(v).toLowerCase() !== "null") {
                const cleanKey = k.toLowerCase().trim();
                const valStr = Array.isArray(v) ? v.join(", ") : String(v).trim();
                if (valStr) {
                  variantObj[cleanKey] = valStr;
                }
              }
            });

            if (Object.keys(variantObj).length > 0) {
              const isDuplicate = availableVariants.some(existing => 
                JSON.stringify(existing) === JSON.stringify(variantObj)
              );
              if (!isDuplicate) {
                availableVariants.push(variantObj);
              }
            }
          }
        });

        missingProducts.push({
          product_name: product.name,
          error_type: "invalid_variant",
          available_variants: availableVariants // Add variants list here!
        });
        continue; 
      }

      // Check 2: Check for MISSING required attributes (Size / Color)
      const requiredFields = (Array.isArray(product.required_fields) && product.required_fields.length > 0)
        ? product.required_fields 
        : (product.attributes?.size || products.some(p => p.attributes?.size) ? ["size"] : []);

      const missingFields: string[] = [];

      for (const field of requiredFields) {
        const cleanField = field.toLowerCase().trim();
        if (!cleanIncomingAttributes[cleanField]) {
          missingFields.push(cleanField);
        }
      }

      if (missingFields.length > 0 && !isBuyIntent) {
        // 🛠️ Extract exact available variant combinations across all matching products
        const availableVariants: Array<Record<string, string>> = [];

        products.forEach((p: any) => {
          if (p.attributes) {
            const variantObj: Record<string, string> = {};
            Object.entries(p.attributes).forEach(([k, v]) => {
              if (v !== null && v !== undefined && String(v).toLowerCase() !== "null") {
                const cleanKey = k.toLowerCase().trim();
                const valStr = Array.isArray(v) ? v.join(", ") : String(v).trim();
                if (valStr) {
                  variantObj[cleanKey] = valStr;
                }
              }
            });

            if (Object.keys(variantObj).length > 0) {
              // Avoid duplicate variant combinations
              const isDuplicate = availableVariants.some(existing => 
                JSON.stringify(existing) === JSON.stringify(variantObj)
              );
              if (!isDuplicate) {
                availableVariants.push(variantObj);
              }
            }
          }
        });

        missingProducts.push({
          product_name: product.name,
          error_type: "missing_attributes",
          missing_fields: missingFields,
          available_variants: availableVariants, // Passed directly as structured variants
        });
        continue; 
      }

      const unitPrice = Number(product.price);
      const subtotal = unitPrice * requestedQuantity;

      grandSubtotal += subtotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: cleanIncomingAttributes,
        unit_price: unitPrice,
        subtotal,
      });
    }

    // 1. Read dynamic shipping rules sent from n8n (defaults: threshold = 999, standard fee = 40)
const threshold = body.shipping_threshold !== undefined && body.shipping_threshold !== null && !isNaN(Number(body.shipping_threshold))
  ? Number(body.shipping_threshold) 
  : 999;

const standardFee = body.shipping_fee !== undefined && body.shipping_fee !== null && !isNaN(Number(body.shipping_fee))
  ? Number(body.shipping_fee) 
  : 40; // Fallback standard charge so missing inputs never accidentally make shipping free

// 2. Exact amount calculation
grandShipping = grandSubtotal >= threshold ? 0 : standardFee;

    // SAVE COMPLETE WORKING CART BACK TO SUPABASE
    const normalizedCartItems = finalItemsToProcess.map((item: any) => {
  const normalizedSelectedAttributes = Object.entries(item.selected_attributes || {}).reduce(
    (acc: any, [key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        acc[String(key).toLowerCase().trim()] = String(value).trim();
      }
      return acc;
    },
    {}
  );

  return {
    product_id: item.product_id || null,
    product_name: item.product_name,
    quantity: item.quantity || 1,
    selected_attributes: normalizedSelectedAttributes,
  };
});

console.log("normalizedCartItems before save:", JSON.stringify(normalizedCartItems, null, 2));

const firstItem = normalizedCartItems[0] || null;

const { error: cartSaveError } = await supabase
  .from("cart_sessions")
  .upsert(
    {
      session_id: sessionId,
      product_id: firstItem?.product_id || firstItem?.product_name || "draft_item",
      product_name: firstItem?.product_name || "multi_item_cart",
      quantity: normalizedCartItems.reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 1),
        0
      ),
      selected_attributes: firstItem?.selected_attributes || {},
      cart_items: normalizedCartItems,
      cart_status: missingProducts.length > 0 ? "pending" : "done",
      current_flow: "whatsapp_ecommerce",
      current_step: missingProducts.length > 0 ? "collect_attributes" : "checkout",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );

if (cartSaveError) {
  console.error("Cart save error:", cartSaveError);
  return NextResponse.json(
    { success: false, message: "Failed to save cart state." },
    { status: 500 }
  );
}

    // 🔴 PROMPT USER FOR MISSING OR INVALID ATTRIBUTES
    if (!isBuyIntent && missingProducts.length > 0) {

      function buildVariantsText(item: any) {
        const variants = item.available_variants || [];
        if (variants.length === 0) return "";

        const ignoredKeys = ["currency", "id", "user_id", "created_at", "updated_at", "price"];

        return variants.map((variant: Record<string, string>, idx: number) => {
          const details = Object.entries(variant)
            .filter(([key]) => !ignoredKeys.includes(key.toLowerCase().trim()))
            .map(([key, val]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: _${val}_`)
            .join(", ");
          
          return `\n${idx + 1}. ${details}`;
        }).join("");
      }

      const completelyNotFound = missingProducts.filter(p => p.error_type === "not_found");
      const invalidVariants = missingProducts.filter(p => p.error_type === "invalid_variant");

      if (completelyNotFound.length > 0) {
        const { data: storeAlternatives } = await supabase
          .from('products')
          .select('name')
          .eq('user_id', user_id)
          .eq('product_type', 'meta')
          .limit(3);

        const suggestionsList = storeAlternatives ? storeAlternatives.map(p => p.name).join(", ") : "";
        const failedNames = completelyNotFound.map(p => `*"${p.product_name}"*`).join(" and ");

        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: `The item ${failedNames} was not found in our WhatsApp catalog.\n\n*Try options like:* _${suggestionsList}_`
        });
      }

      if (invalidVariants.length > 0) {
        let customErrorMessage = "Sorry, those specific combinations are unavailable:\n";
        
        invalidVariants.forEach((item, index) => {
          customErrorMessage += `\n*${index + 1}. ${item.product_name}:*`;
          
          const choices = buildVariantsText(item);
          if (choices) {
            customErrorMessage += choices;
          } else {
            customErrorMessage += "\nNo matching variants found.";
          }
          customErrorMessage += `\n`;
        });
        
        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_products: missingProducts,
          message: customErrorMessage.trim()
        });
      }

      let userFriendlyMessage = "";

      if (missingProducts.length === 1) {
        const item = missingProducts[0];
        const missingFieldsList = item.missing_fields.join(" and ");
        const choices = buildVariantsText(item);

        userFriendlyMessage = `Please reply with your preferred *${missingFieldsList}* option for *${item.product_name}*.`;
        if (choices) {
          userFriendlyMessage += `\n\n*AVAILABLE CHOICES:*${choices}`;
        }
      } else {
        userFriendlyMessage = `Please specify required options for the following products:\n`;
        
        missingProducts.forEach((item, index) => {
          const missingFieldsList = item.missing_fields.join(" and ");
          userFriendlyMessage += `\n*${index + 1}. ${item.product_name}* (Missing: ${missingFieldsList})`;
        });

        userFriendlyMessage += `\n\n*AVAILABLE CHOICES:*`;
        missingProducts.forEach((item) => {
          const choices = buildVariantsText(item);
          if (choices) {
            userFriendlyMessage += `\n\n*For ${item.product_name}:*${choices}`;
          }
        });
      }

      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: userFriendlyMessage
      });
    }

      

    // 🟢 UNIFIED SUCCESS RESPONSE GENERATION (Supports 1 or multiple items)
    const itemsSummary = validatedItems
      .map(i => {
        const attrs = Object.entries(i.selected_attributes)
          .map(([k, v]) => `*${k}:* _${v}_`)
          .join(", ");
        return `• *${i.product_name}* ${attrs ? `(${attrs})` : ""}`;
      })
      .join("\n");

    const responseMessage = isMultiProductSession
      ? `Great! I've confirmed everything is in stock:\n\n${itemsSummary}\n\n*Subtotal:* ₹${grandSubtotal}\n*Shipping:* ${grandShipping === 0 ? "_FREE_" : `₹${grandShipping}`}\n*Total:* *₹${grandSubtotal + grandShipping}*\n\nAre you interested to buy these products? Kindly confirm. Yes. Kindly share your *Name, Email, phone and Delivery Address* to complete checkout.`
      : `🛍️ *Order Summary verified successfully!*\n\n${itemsSummary}\n\n*Subtotal:* ₹${grandSubtotal}\n*Shipping:* ${grandShipping === 0 ? "_FREE_" : `₹${grandShipping}`}\n*Total:* *₹${grandSubtotal + grandShipping}*\n\nKindly share your *Name, Email, phone and Delivery Address* to complete checkout.`;

    return NextResponse.json({
      success: true,
      requires_confirmation: isMultiProductSession,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping,
      message: responseMessage,
    });

  } catch (err: any) {
    console.error("Critical Route Error:", err);
    return NextResponse.json({ success: false, message: "Oops! An unexpected system error occurred." }, { status: 500 });
  }
}