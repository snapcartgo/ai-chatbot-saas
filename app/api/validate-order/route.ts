import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type IncomingItem = {
  product_name: string;
  quantity: number;
  selected_attributes?: Record<string, any>;
};

function safeJsonParse(value: any, fallback: any) {
  if (!value) return fallback;

  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function normalizeSearchTerm(input: string) {
  let search = String(input || "").trim().toLowerCase();

  if (search === "tshirt" || search === "t shirt" || search === "shirt") {
    search = "t-shirt";
  }

  return search;
}

function normalizeAttributes(attributes: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(attributes || {}).map(([key, value]) => [
      String(key).toLowerCase().trim(),
      typeof value === "string" ? value.toLowerCase().trim() : value,
    ])
  );
}

function matchesVariant(
  selectedAttributes: Record<string, any>,
  availableOptions: Record<string, any>
) {
  for (const [key, selectedValue] of Object.entries(selectedAttributes)) {
    const optionValue = availableOptions?.[key];

    if (Array.isArray(optionValue)) {
      const normalizedOptions = optionValue.map((v) =>
        String(v).toLowerCase().trim()
      );

      if (!normalizedOptions.includes(String(selectedValue).toLowerCase().trim())) {
        return false;
      }
    } else if (
      optionValue !== undefined &&
      optionValue !== null &&
      String(optionValue).trim() !== ""
    ) {
      if (
        String(optionValue).toLowerCase().trim() !==
        String(selectedValue).toLowerCase().trim()
      ) {
        return false;
      }
    }
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const user_id = body.user_id;
    const items: IncomingItem[] = Array.isArray(body.items) ? body.items : [];

    if (!user_id) {
      return NextResponse.json(
        { success: false, message: "Missing user_id." },
        { status: 400 }
      );
    }

    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "No items provided." },
        { status: 400 }
      );
    }

    const validatedItems: any[] = [];
    const missingProducts: any[] = [];
    let grandSubtotal = 0;
    let grandShipping = 0;

    for (const item of items) {
      const requestedQuantity = Number(item.quantity || 1);
      const selectedAttributes = normalizeAttributes(item.selected_attributes || {});
      const productName = String(item.product_name || "").trim();

      if (!productName) {
        continue;
      }

      const search = normalizeSearchTerm(productName);

// Split the search phrase into individual words (e.g., ["blue", "jeans"])
const words = search.split(/\s+/).filter(Boolean);

let query = supabase
  .from("products")
  .select("*")
  .eq("user_id", user_id);

// Dynamically chain filters so ALL words must match somewhere in name, category, or description
for (const word of words) {
  query = query.or(`name.ilike.%${word}%,category.ilike.%${word}%,description.ilike.%${word}%`);
}

const { data: products, error: productError } = await query;

      if (productError) {
        console.error("Product search error:", productError);
        return NextResponse.json(
          { success: false, message: "Product search failed." },
          { status: 500 }
        );
      }

      if (!products || products.length === 0) {
        missingProducts.push({
          product_name: productName,
          error_type: "not_found",
        });
        continue;
      }

      let product = products[0];

      const requiredFields: string[] = safeJsonParse(product.required_fields, []);
      const availableOptions = safeJsonParse(
        product.allowed_options || product.attributes,
        {}
      );

      const missingFields: string[] = [];

      for (const field of requiredFields) {
        const normalizedField = String(field).toLowerCase().trim();
        if (!selectedAttributes[normalizedField]) {
          missingFields.push(normalizedField);
        }
      }

      if (missingFields.length > 0) {
        missingProducts.push({
          product_name: product.name,
          missing_fields: missingFields,
          available_options: availableOptions,
        });
        continue;
      }

      const variantMatched = matchesVariant(selectedAttributes, availableOptions);

      if (!variantMatched) {
        missingProducts.push({
          product_name: product.name,
          error_type: "invalid_variant",
          requested_attributes: selectedAttributes,
          available_options: availableOptions,
        });
        continue;
      }

      const unitPrice = Number(product.price || 0);
      const productStock = Number(product.stock || 0);

      if (requestedQuantity > productStock) {
        return NextResponse.json({
          success: false,
          message: `Only ${productStock} left for ${product.name}.`,
        });
      }

      const subtotal = unitPrice * requestedQuantity;
      const shipping = subtotal >= 999 ? 0 : 1;

      grandSubtotal += subtotal;
      grandShipping += shipping;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        selected_attributes: selectedAttributes,
        subtotal,
      });
    }

    // =========================================================================
    // 5. EVALUATE TARGET MISSING/INVALID SELECTION PAYLOADS
    // =========================================================================
    if (missingProducts.length > 0) {
      const completelyNotFound = missingProducts.filter(
        (p) => p.error_type === "not_found"
      );
      const invalidVariants = missingProducts.filter(
        (p) => p.error_type === "invalid_variant"
      );

      if (completelyNotFound.length > 0) {
        const { data: storeAlternatives } = await supabase
          .from("products")
          .select("name")
          .eq("user_id", user_id)
          .limit(3);

        const suggestionsList = storeAlternatives?.length
          ? storeAlternatives.map((p) => p.name).join(", ")
          : "";

        const failedNames = completelyNotFound
          .map((p) => `"${p.product_name}"`)
          .join(" and ");

        return NextResponse.json({
          success: false,
          requires_selection: true,
          message: `The item ${failedNames} is currently not matching our store catalog format. Try: ${suggestionsList}`,
        });
      }

      if (invalidVariants.length > 0) {
        const item = invalidVariants[0];
        const allowedColors = Array.isArray(item.available_options?.color)
          ? item.available_options.color.join(" or ")
          : "";
        const allowedSizes = Array.isArray(item.available_options?.size)
          ? item.available_options.size.join(", ")
          : "";

        let customErrorMessage = `Sorry, that specific combination is not available for ${item.product_name}.`;

        if (allowedColors || allowedSizes) {
          customErrorMessage += " We currently have this item available in:";
          if (allowedColors) customErrorMessage += `\n• Colors: ${allowedColors}`;
          if (allowedSizes) customErrorMessage += `\n• Sizes: ${allowedSizes}`;
        }

        return NextResponse.json({
          success: false,
          requires_selection: true,
          missing_products: missingProducts,
          message: customErrorMessage,
        });
      }

      // Scenario C: show missing fields + available options for single and multiple products
      let userFriendlyMessage = "";

      const buildOptionsText = (item: any) => {
        const opts = item.available_options || {};
        const optionsStringArray: string[] = [];

        Object.entries(opts).forEach(([key, values]) => {
          if (Array.isArray(values) && values.length > 0) {
            const label = key.charAt(0).toUpperCase() + key.slice(1) + "s";
            optionsStringArray.push(`\n- ${label}: ${values.join(" or ")}`);
          } else if (
            typeof values === "string" &&
            values.trim().toLowerCase() !== "null" &&
            values.trim() !== ""
          ) {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            optionsStringArray.push(`\n- ${label}: ${values}`);
          }
        });

        if (optionsStringArray.length === 0) return "";

        return `\nAvailable Choices:${optionsStringArray.join("")}`;
      };

      if (missingProducts.length === 1) {
        const item = missingProducts[0];
        const missingFieldsList = item.missing_fields.join(" and ");

        userFriendlyMessage = `Please select options (${missingFieldsList}) for ${item.product_name}.`;
        userFriendlyMessage += `\n${buildOptionsText(item)}`;
      } else {
        userFriendlyMessage =
          "Please select required options for the following products:\n\n";

        missingProducts.forEach((item, index) => {
          const missingFieldsList = item.missing_fields.join(" and ");

          userFriendlyMessage += `${index + 1}. ${item.product_name}\n`;
          userFriendlyMessage += `Missing: ${missingFieldsList}\n`;

          const optionsText = buildOptionsText(item);
          if (optionsText) {
            userFriendlyMessage += `${optionsText}\n`;
          }

          userFriendlyMessage += `\n`;
        });

        userFriendlyMessage = userFriendlyMessage.trim();
      }

      return NextResponse.json({
        success: false,
        requires_selection: true,
        missing_products: missingProducts,
        message: userFriendlyMessage,
      });
    }

    // Success! All items verified cleanly
    return NextResponse.json({
      success: true,
      items: validatedItems,
      subtotal: grandSubtotal,
      shipping: grandShipping,
      total: grandSubtotal + grandShipping,
      message:
        "All products are available. Kindly share your Name, Email and Phone Number.",
    });
  } catch (err: any) {
    console.error("validate-order error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Error." },
      { status: 500 }
    );
  }
}