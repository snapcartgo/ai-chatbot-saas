import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function scrapeProductDetails(productUrl: string) {
  try {
    const res = await fetch(productUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. EXTRACT CATEGORY FROM DETAIL PAGE
    let extractedCategory = "";
    $("*").each((_, el) => {
      const txt = $(el).clone().children().remove().end().text().trim();
      if (/^Category$/i.test(txt) || txt.startsWith("Category:")) {
        const val = $(el).next().text().trim() || $(el).parent().find("p, span, div, a").last().text().trim();
        if (val && val.length < 30 && !extractedCategory && !/category/i.test(val)) {
          extractedCategory = val;
        }
      }
    });

    // 2. EXTRACT EXACT SKU (Matches WP-0001 to WP-0010)
    let extractedSku: string | null = null;
    const bodyText = $("body").text();

    const strictSkuMatch = bodyText.match(/WP-\d{4}/i);
    if (strictSkuMatch) {
      extractedSku = strictSkuMatch[0].toUpperCase();
    }

    if (!extractedSku) {
      $('[class*="sku"], [id*="sku"]').each((_, el) => {
        const text = $(el).text().replace(/SKU:?/i, "").trim();
        const m = text.match(/([A-Z]{2,4}-\d{3,6})/i);
        if (m && !extractedSku) {
          extractedSku = m[1].toUpperCase();
        }
      });
    }

    // 3. EXTRACT ATTRIBUTES (Color & Material)
    const attributes: Record<string, string[]> = {};
    const requiredFields: string[] = [];

    // Option / Swatch Buttons
    const colorSwatches: string[] = [];
    $("button, [class*='swatch'], [class*='option'], [class*='chip']").each((_, el) => {
      const txt = $(el).text().trim();
      if (
        txt &&
        !/add to cart|buy|select|sku|product|specifications|description/i.test(txt) &&
        txt.length < 25
      ) {
        colorSwatches.push(txt);
      }
    });

    if (colorSwatches.length > 0) {
      attributes["color"] = Array.from(new Set(colorSwatches));
      requiredFields.push("color");
    }

    // Specification Grid parsing
    let materialVal = "";
    let colorVal = "";

    $("*").each((_, el) => {
      const txt = $(el).clone().children().remove().end().text().trim();

      if (/^Material$/i.test(txt)) {
        const next = $(el).next().text().trim() || $(el).parent().find("p, span, div").last().text().trim();
        if (next && next.length < 50 && !materialVal) {
          materialVal = next;
        }
      }

      if (/^Color$/i.test(txt)) {
        const next = $(el).next().text().trim() || $(el).parent().find("p, span, div").last().text().trim();
        if (next && next.length < 50 && !colorVal) {
          colorVal = next;
        }
      }
    });

    // Subtitle bullet text fallback
    if (!materialVal || !colorVal) {
      const bulletMatch = bodyText.match(/([A-Za-z0-9\s-]+)\s*•\s*([A-Za-z0-9\s-]+)/);
      if (bulletMatch) {
        if (!materialVal && bulletMatch[1]) materialVal = bulletMatch[1].trim();
        if (!colorVal && bulletMatch[2]) colorVal = bulletMatch[2].trim();
      }
    }

    if (materialVal) {
      attributes["material"] = [materialVal];
    }

    if (!attributes["color"] && colorVal) {
      attributes["color"] = [colorVal];
      requiredFields.push("color");
    }

    return {
      category: extractedCategory,
      sku: extractedSku,
      attributes: Object.keys(attributes).length > 0 ? attributes : { option: ["Standard"] },
      required_fields: requiredFields,
    };
  } catch (e) {
    console.error(`Scrape failed for ${productUrl}:`, e);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { websiteUrl, userId } = body;

    if (!websiteUrl || !userId) {
      return NextResponse.json({ error: "Missing websiteUrl or userId" }, { status: 400 });
    }

    const formattedUrl = websiteUrl.endsWith("/") ? websiteUrl.slice(0, -1) : websiteUrl;

    const pageRes = await fetch(formattedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const html = await pageRes.text();
    const $ = cheerio.load(html);

    const productsToInsert: any[] = [];
    const cardElements = $('a[href*="/product"], div[class*="product"], article').toArray();

    for (const el of cardElements) {
      const $card = $(el);

      const title = $card.find('h2, h3, h4, [class*="title"], [class*="name"]').first().text().trim();
      const description = $card.find("p").text().trim();
      const priceText = $card.find('[class*="price"], span:contains("$"), span:contains("₹")').first().text();
      const cleanPrice = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

      let imgUrl = $card.find("img").first().attr("src") || $card.find("img").first().attr("data-src") || "";
      if (imgUrl && !imgUrl.startsWith("http")) {
        imgUrl = new URL(imgUrl, formattedUrl).href;
      }

      // Check category badge directly on the product card element
      let cardCategory = $card.find('span[class*="badge"], span[class*="tag"], [class*="category"], div[class*="uppercase"]').first().text().trim();

      let extractedHref = $card.is("a") ? $card.attr("href") : $card.find("a").attr("href") || $card.closest("a").attr("href");
      let fullProductUrl = formattedUrl;
      if (extractedHref) {
        fullProductUrl = extractedHref.startsWith("http") ? extractedHref : new URL(extractedHref, formattedUrl).href;
      } else if (title) {
        fullProductUrl = `${formattedUrl}/products/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      }

      const details = await scrapeProductDetails(fullProductUrl);

      // RESOLVE ACCURATE CATEGORY
      let finalCategory = details?.category || cardCategory || "";

      // Smart title matcher fallback if category is blank or "General"
      if (!finalCategory || finalCategory.toLowerCase() === "general") {
        const t = title.toLowerCase();
        if (t.includes("coffee table")) finalCategory = "Coffee Tables";
        else if (t.includes("dining table") || t.includes("farmhouse table") || t.includes("table")) finalCategory = "Dining Tables";
        else if (t.includes("chair") || t.includes("armchair")) finalCategory = "Chairs";
        else if (t.includes("bed")) finalCategory = "Beds";
        else if (t.includes("sofa")) finalCategory = "Sofas";
        else finalCategory = "General";
      }

      // Format category capitalization cleanly
      finalCategory = finalCategory
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());

      // Force-resolve SKU directly from detail extraction result
      const finalSku = details?.sku || null;

      if (title && title.length > 2 && finalSku && !productsToInsert.some((p) => p.name === title)) {
        productsToInsert.push({
          user_id: userId,
          name: title,
          description: description || `Imported product from ${formattedUrl}`,
          price: cleanPrice,
          category: finalCategory,
          image_url: imgUrl,
          product_url: fullProductUrl,
          website_url: fullProductUrl,
          sku: finalSku,
          attributes: details?.attributes || { option: ["Standard"] },
          required_fields: details?.required_fields || [],
          product_type: "website",
        });
      }
    }

    const validProducts = productsToInsert.filter((p) => Boolean(p.name) && Boolean(p.sku));

    const { error } = await supabase.from("products").upsert(validProducts, {
      onConflict: "user_id,sku",
    });

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: validProducts.length,
      message: `Successfully synced ${validProducts.length} products with clean SKUs!`,
    });
  } catch (err: any) {
    console.error("Sync route error:", err);
    return NextResponse.json({ error: err.message || "Failed to sync website" }, { status: 500 });
  }
}