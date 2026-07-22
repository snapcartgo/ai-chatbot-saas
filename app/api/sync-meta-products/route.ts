import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type SyncRequestBody = {
  user_id?: string;
};

type WhatsAppConfigRow = {
  user_id: string;
  meta_catalog_id?: string | null;
  catalog_id?: string | null;
  meta_access_token?: string | null;
  whatsapp_access_token?: string | null;
};

type MetaPriceObject = {
  amount?: number | string | null;
  currency?: string | null;
};

type MetaProduct = {
  id: string;
  retailer_id?: string | null;
  name?: string | null;
  description?: string | null;
  price?: string | MetaPriceObject | null;
  availability?: string | null;
  image_url?: string | null;
  url?: string | null;
  category?: string | null;
  currency?: string | null;

  // Allow any other Meta attributes dynamically
  [key: string]: any;
};

type MetaProductsResponse = {
  data?: MetaProduct[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type ExistingProductRow = {
  product_id?: string;
  retailer_id?: string | null;
  required_fields?: unknown;
  attributes?: unknown;
  allowed_options?: unknown;
  size?: string | null;
  product_type?: string | null;
  category?: string | null;
  payment_link?: string | null;
  website_url?: string | null;
};

type ProductInsertRow = {
  product_id?: string | null;
  user_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  product_url: string | null;
  stock: number;
  website_url: string | null;
  color: string | null;
  size: string | null;
  currency: string | null;
  payment_link: string | null;
  sku: string | null;
  required_fields: string[] | null;
  attributes: Record<string, unknown> | null;
  allowed_options: Record<string, unknown> | null;
  product_type: string | null;
  retailer_id: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getConfigCatalogId(config: WhatsAppConfigRow | null): string | null {
  return String(config?.meta_catalog_id || "").trim() || null;
}

function getConfigAccessToken(config: WhatsAppConfigRow | null): string | null {
  return (
    String(config?.meta_access_token || "").trim() ||
    String(config?.whatsapp_access_token || "").trim() ||
    null
  );
}

function parseMetaPrice(
  price: MetaProduct["price"],
  fallbackCurrency?: string | null
): { amount: number; currency: string | null } {
  if (price && typeof price === "object" && !Array.isArray(price)) {
    const obj = price as MetaPriceObject;
    const parsedAmount = Number(obj.amount ?? 0);
    return {
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      currency: obj.currency ? String(obj.currency).trim() : fallbackCurrency || null,
    };
  }

  if (typeof price === "string") {
    const numeric = Number(String(price).replace(/[^0-9.-]/g, ""));
    return {
      amount: Number.isFinite(numeric) ? numeric : 0,
      currency: fallbackCurrency || null,
    };
  }

  return {
    amount: 0,
    currency: fallbackCurrency || null,
  };
}

function mapAvailabilityToStock(availability?: string | null): number {
  const normalized = String(availability || "").toLowerCase().trim();

  if (
    normalized === "out of stock" ||
    normalized === "out_of_stock" ||
    normalized === "sold out" ||
    normalized === "sold_out"
  ) {
    return 0;
  }

  return 999;
}

// 🟢 FIX: Clean extractor to intercept categories from string formats or deeply-nested objects
function parseMetaCategory(meta: any): string | null {
  // 1. Try standard Meta API fields first
  if (meta.product_type) return String(meta.product_type).trim();
  if (meta.category_name) return String(meta.category_name).trim();
  
  if (meta.product_category) {
    if (typeof meta.product_category === 'object') {
      return meta.product_category.name || meta.product_category.id || null;
    }
    return String(meta.product_category).trim();
  }

  if (meta.google_product_category) {
    if (typeof meta.google_product_category === 'object') {
      return meta.google_product_category.name || meta.google_product_category.id || null;
    }
    return String(meta.google_product_category).trim();
  }

  if (meta.category_specific_spec?.google_product_category) {
    return String(meta.category_specific_spec.google_product_category).trim();
  }

  // 2. 🟢 SMART FALLBACK: If Meta returns nothing, auto-detect using keywords
  const searchText = `${meta.name || ''} ${meta.description || ''}`.toLowerCase();
  
  if (searchText.includes("t-shirt") || searchText.includes("jeans") || searchText.includes("shirt") || searchText.includes("clothing")) {
    return "Clothing";
  }
  if (searchText.includes("earbuds") || searchText.includes("headphone") || searchText.includes("battery") || searchText.includes("noise cancellation")) {
    return "Electronics";
  }
  if (searchText.includes("shoes") || searchText.includes("sneaker")) {
    return "Footwear";
  }

  return null;
}

function buildAllowedOptionsFromMeta(meta: MetaProduct): Record<string, unknown> | null {
  const allowedOptions: Record<string, unknown> = {};

  if (meta.color && String(meta.color).trim()) {
    allowedOptions.color = [String(meta.color).trim()];
  }
  
  if (meta.size && String(meta.size).trim()) {
    allowedOptions.size = [String(meta.size).trim()];
  }

  return Object.keys(allowedOptions).length > 0 ? allowedOptions : null;
}

function buildAttributesFromMeta(meta: MetaProduct): Record<string, unknown> | null {
  const attributes: Record<string, unknown> = {};

  const ignoredFields = [
    "id",
    "retailer_id",
    "name",
    "description",
    "price",
    "availability",
    "image_url",
    "url",
    "category",
    "currency",
    "google_product_category",
    "product_category",
    "category_specific_spec",
    "product_type"
  ];

  for (const [key, value] of Object.entries(meta)) {
    if (
      ignoredFields.includes(key) ||
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      attributes[key] = value.map(String);
    } else {
      attributes[key] = [String(value)];
    }
  }

  if (meta.currency) {
    attributes.currency = String(meta.currency);
  }

  return Object.keys(attributes).length > 0 ? attributes : null;
}

async function uploadMetaImage(
  imageUrl: string,
  userId: string,
  retailerId: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error("Failed to download image");
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    const contentType =
      response.headers.get("content-type") || "image/jpeg";

    const extension = contentType.split("/")[1] || "jpg";

    const fileName = `${userId}/${retailerId}.${extension}`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(error);
      return null;
    }

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("Starting sync-meta-products");

    const body = (await req.json()) as SyncRequestBody;
    const userId = String(body?.user_id || "").trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("user_id, meta_catalog_id, meta_access_token, whatsapp_access_token")
      .eq("user_id", userId)
      .maybeSingle<WhatsAppConfigRow>();

    if (configError) {
      console.error("WhatsApp config lookup error:", configError);
      return NextResponse.json(
        { success: false, error: configError.message },
        { status: 500 }
      );
    }

    const catalogId = req.headers.get("x-catalog-id") || config?.meta_catalog_id;
    const accessToken = req.headers.get("x-access-token") || config?.meta_access_token || config?.whatsapp_access_token;

    console.log("Catalog ID:", catalogId);

    if (!catalogId || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Meta catalog or Meta access token is not configured for this user",
        },
        { status: 400 }
      );
    }

    const allProducts: MetaProduct[] = [];
    let currentPage = 1;
    
    // 🟢 FIX: Added product_type, product_category, and structural spec nodes to the fields query parameters
    let nextUrl =
      `https://graph.facebook.com/v20.0/${catalogId}/products` +
      `?fields=id,retailer_id,name,description,price,availability,image_url,url,color,currency,size,gender,google_product_category,product_category,category_specific_spec,product_type` +
      `&limit=100&access_token=${encodeURIComponent(accessToken)}`;

    while (nextUrl) {
      console.log("Current page:", currentPage);

      const metaResponse = await fetch(nextUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const metaData = (await metaResponse.json()) as MetaProductsResponse;

      if (!metaResponse.ok) {
        console.error("Meta API error:", metaData?.error || metaData);
        return NextResponse.json(
          {
            success: false,
            error: metaData?.error?.message || "Failed to fetch products from Meta catalog",
            meta_error: metaData?.error || null,
          },
          { status: 500 }
        );
      }

      const pageProducts = Array.isArray(metaData.data) ? metaData.data : [];
      console.log("Products fetched:", pageProducts.length);

      allProducts.push(...pageProducts);
      nextUrl = metaData.paging?.next || "";
      currentPage += 1;
    }

    if (allProducts.length === 0) {
      console.log("Sync completed");
      return NextResponse.json({
        success: true,
        imported: 0,
        updated: 0,
        total: 0,
      });
    }

    const retailerIds = allProducts
      .map((product) => String(product.retailer_id || "").trim())
      .filter(Boolean);

    const { data: existingRows, error: existingError } = await supabase
      .from("products")
      .select("product_id, retailer_id, required_fields, attributes, allowed_options, size, product_type, category, payment_link, website_url")
      .eq("user_id", userId)
      .in("retailer_id", retailerIds);

    if (existingError) {
      console.error("Existing products lookup error:", existingError);
      return NextResponse.json(
        { success: false, error: existingError.message },
        { status: 500 }
      );
    }

    const existingMap = new Map<string, ExistingProductRow>();
    for (const row of (existingRows || []) as ExistingProductRow[]) {
      const key = String(row.retailer_id || "").trim();
      if (key) {
        existingMap.set(key, row);
      }
    }

    const inserts: ProductInsertRow[] = [];
    const updates: ProductInsertRow[] = [];

    for (const metaProduct of allProducts) {
  const retailerId = String(metaProduct.retailer_id || "").trim();

  if (!retailerId) {
    continue;
  }

  // 🟢 ADD THIS TEMPORARY LOG TO SEE THE EXACT KEYS META SENDS
  console.log("RAW META PRODUCT FIELDS:", Object.keys(metaProduct), {
    product_type: metaProduct.product_type,
    google_product_category: metaProduct.google_product_category,
    product_category: metaProduct.product_category
  });

  const existing = existingMap.get(retailerId) || null;
  // ... rest of the loop remains the same
      const parsedPrice = parseMetaPrice(metaProduct.price, metaProduct.currency || null);
      const colorValue = String(metaProduct.color || "").trim() || null;
      const sizeValue = String(metaProduct.size || "").trim() || null;

      // 🟢 FIX: Create a fresh required fields array dynamically on every run
      const currentRequiredFields: string[] = [];
      if (colorValue) currentRequiredFields.push("color");
      if (sizeValue) currentRequiredFields.push("size");

      // 🟢 FIX: Extract structural data to prevent dropping updates for existing records
      const freshAttributes = buildAttributesFromMeta(metaProduct);
      const freshAllowedOptions = buildAllowedOptionsFromMeta(metaProduct);

      // Find this block inside your for (const metaProduct of allProducts) loop:
      let imageUrl: string | null = null;

if (metaProduct.image_url) {
  imageUrl = await uploadMetaImage(
    metaProduct.image_url,
    userId,
    retailerId
  );
}

      const payload: ProductInsertRow = {
        user_id: userId,
        name: String(metaProduct.name || retailerId).trim(),
        description: metaProduct.description ? String(metaProduct.description).trim() : null,
        price: parsedPrice.amount,
        category: parseMetaCategory(metaProduct) || existing?.category || null,
        image_url: imageUrl,
        product_url: metaProduct.url ? String(metaProduct.url).trim() : null,
        stock: mapAvailabilityToStock(metaProduct.availability),
        website_url: metaProduct.url ? String(metaProduct.url).trim() : existing?.website_url || null,
        color: colorValue,
        size: sizeValue || existing?.size || null,
        currency: parsedPrice.currency,
        payment_link: existing?.payment_link || null,
        sku: retailerId,
        required_fields: currentRequiredFields,
        attributes: freshAttributes || (existing?.attributes as Record<string, unknown> | null),
        allowed_options: freshAllowedOptions || (existing?.allowed_options as Record<string, unknown> | null),
        
        // 🟢 CHANGE THIS LINE RIGHT HERE:
        product_type: "meta", // <-- Hardcode this as 'meta' so all synchronized items label correctly
        
        retailer_id: retailerId,
      };

      if (existing) {
        updates.push(payload);
      } else {
        inserts.push(payload);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("products").insert(inserts);

      if (insertError) {
        console.error("Products insert error:", insertError);
        return NextResponse.json(
          { success: false, error: insertError.message },
          { status: 500 }
        );
      }

      insertedCount = inserts.length;
      console.log("Products inserted:", insertedCount);
    } else {
      console.log("Products inserted:", 0);
    }

    if (updates.length > 0) {
      for (const payload of updates) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("user_id", userId)
          .eq("retailer_id", payload.retailer_id);

        if (error) {
          console.error("Products update error:", error);
          return NextResponse.json(
            {
              success: false,
              error: error.message,
            },
            { status: 500 }
          );
        }
      }

      updatedCount = updates.length;
      console.log("Products updated:", updatedCount);
    }
    
    console.log("Sync completed");

    return NextResponse.json({
      success: true,
      imported: insertedCount,
      updated: updatedCount,
      total: insertedCount + updatedCount,
    });
  } catch (error) {
    console.error("sync-meta-products fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}