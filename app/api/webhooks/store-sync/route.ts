import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Validates and sanitizes URLs against SSRF vectors (Private IPs, Localhost, Cloud Metadata)
 */
function getSafeFetchUrl(urlString: string): string | null {
  if (!urlString || typeof urlString !== "string") return null;
  try {
    const parsed = new URL(urlString);

    // Enforce strict HTTP/HTTPS protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase();

    // Block non-standard or missing hostnames
    if (!hostname || hostname.length > 253) return null;

    // Reject localhost and local domain zones
    const localHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];
    if (localHostnames.includes(hostname)) return null;

    const localSuffixes = [".local", ".internal", ".lan", ".home", ".corp"];
    if (localSuffixes.some((suffix) => hostname.endsWith(suffix))) return null;

    // Block IPv4 private ranges, loopback, link-local, and AWS/cloud metadata (169.254.x.x)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = hostname.match(ipv4Regex);
    if (ipv4Match) {
      const [b0, b1] = [parseInt(ipv4Match[1], 10), parseInt(ipv4Match[2], 10)];
      if (
        b0 === 10 || // 10.0.0.0/8
        b0 === 127 || // 127.0.0.0/8
        b0 === 0 || // 0.0.0.0/8
        (b0 === 172 && b1 >= 16 && b1 <= 31) || // 172.16.0.0/12
        (b0 === 192 && b1 === 168) || // 192.168.0.0/16
        (b0 === 169 && b1 === 254) // 169.254.0.0/16 (AWS/GCP metadata)
      ) {
        return null;
      }
    }

    // Block IPv6 notation
    if (hostname.startsWith("[") || hostname.includes(":")) {
      return null;
    }

    // Reconstruct clean canonical URL
    const cleanUrl = new URL(`${parsed.protocol}//${parsed.host}${parsed.pathname}`);
    cleanUrl.search = parsed.search;
    return cleanUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Safely strips HTML tags and scripts using Cheerio parser instead of regex
 */
function sanitizeText(htmlContent: string): string {
  if (!htmlContent) return "";
  const $ = cheerio.load(htmlContent);
  $("script, style").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

// Extract the selling price
function extractExactProductPrice($card: cheerio.Cheerio<any>): number {
  const $clone = $card.clone();
  $clone.find("del, s, strike, [class*='old-price'], [class*='regular-price'], [class*='shipping']").remove();

  const selectors = [
    "ins .woocommerce-Price-amount bdi",
    "ins .woocommerce-Price-amount",
    "ins .amount",
    "ins",
    ".woocommerce-Price-amount bdi",
    ".woocommerce-Price-amount",
    ".price-current",
    ".special-price",
    "[class*='price']:not(del)",
    ".amount",
  ];

  for (const s of selectors) {
    const txt = $clone.find(s).first().text().replace(/\u00a0/g, " ").replace(/,/g, "").trim();
    if (txt && !txt.includes("%")) {
      const match = txt.match(/(?:₹|rs\.?|\$|&#8377;)?\s*(\d+(?:\.\d{1,2})?)/i);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (val > 0) return val;
      }
    }
  }

  const rawText = $clone.text().replace(/\u00a0/g, " ").replace(/,/g, "");
  const matches = [...rawText.matchAll(/(?:₹|rs\.?|\$)\s*(\d+(?:\.\d{1,2})?)/gi)];
  for (const m of matches) {
    const val = parseFloat(m[1]);
    if (val > 0 && !rawText.includes(`-${val}%`)) return val;
  }

  return 0;
}

// Scrape detail page for high-res images and fallback prices
async function scrapeDetailPage(productUrl: string) {
  const safeTargetUrl = getSafeFetchUrl(productUrl);
  if (!safeTargetUrl) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(safeTargetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImg =
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content") ||
      $("main img, article img, .product-image img").first().attr("src") ||
      "";

    let extractedSku = "";
    const bodyText = $("body").text();
    const skuMatch = bodyText.match(/WP-\d{4}/i);
    if (skuMatch) extractedSku = skuMatch[0].toUpperCase();

    const detailPrice = extractExactProductPrice($("body"));

    return {
      image: ogImg ? getSafeFetchUrl(ogImg.startsWith("http") ? ogImg : new URL(ogImg, safeTargetUrl).href) : "",
      sku: extractedSku,
      price: detailPrice,
    };
  } catch {
    return null;
  }
}

// Shopify Direct JSON fetcher
async function fetchShopifyProducts(targetUrl: string, userId: string) {
  try {
    const safeBase = getSafeFetchUrl(targetUrl);
    if (!safeBase) return null;

    const parsed = new URL(safeBase);
    const shopifyEndpoint = `${parsed.protocol}//${parsed.host}/products.json?limit=100`;
    const safeUrl = getSafeFetchUrl(shopifyEndpoint);
    if (!safeUrl) return null;

    const res = await fetch(safeUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/json" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.products || !Array.isArray(data.products) || data.products.length === 0) return null;

    return data.products.map((item: any, idx: number) => {
      const variant = item.variants?.[0] || {};
      const img = item.images?.[0]?.src || "";
      const cleanedDesc = sanitizeText(item.body_html || "");

      return {
        user_id: userId,
        name: item.title,
        description: cleanedDesc.slice(0, 200) || `${item.title} available now.`,
        price: parseFloat(variant.price) || 0,
        category: item.product_type || "General",
        image_url: img,
        product_url: `${parsed.protocol}//${parsed.host}/products/${item.handle}`,
        website_url: `${parsed.protocol}//${parsed.host}/products/${item.handle}`,
        sku: variant.sku || `SP-${idx + 1000}`,
        stock: "20",
        attributes: { option: ["Standard"] },
        required_fields: [],
        product_type: "website",
      };
    });
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawWebsiteUrl = body?.websiteUrl;
    const userId = body?.userId;

    if (!rawWebsiteUrl || !userId) {
      return NextResponse.json({ error: "Missing websiteUrl or userId" }, { status: 400 });
    }

    const safeBaseUrl = getSafeFetchUrl(rawWebsiteUrl);
    if (!safeBaseUrl) {
      return NextResponse.json({ error: "Invalid website target" }, { status: 400 });
    }

    let productsToInsert: any[] = [];

    // 1. Shopify
    const shopifyProds = await fetchShopifyProducts(safeBaseUrl, userId);
    if (shopifyProds && shopifyProds.length > 0) {
      productsToInsert = shopifyProds;
    }

    // 2. Dynamic HTML Scraper
    if (productsToInsert.length === 0) {
      const parsed = new URL(safeBaseUrl);
      const urlsToCrawl = [safeBaseUrl];

      if (!safeBaseUrl.includes("lovable.app")) {
        const shopUrl = `${parsed.protocol}//${parsed.host}/shop/`;
        if (safeBaseUrl !== shopUrl) urlsToCrawl.push(shopUrl);
      }

      const seenNames = new Set<string>();

      const bannedTitles = [
        "our blogs",
        "latest news",
        "delivery policy",
        "shipping & delivery policy",
        "shipping and delivery policy",
        "privacy policy",
        "terms",
        "health advantages",
        "health benefits",
        "makhana nutrition",
        "new arrival",
        "hot products",
        "about us",
        "contact us",
        "cart",
        "checkout",
        "my account",
      ];

      for (const targetPage of urlsToCrawl) {
        const verifiedTargetPage = getSafeFetchUrl(targetPage);
        if (!verifiedTargetPage) continue;

        try {
          const pageRes = await fetch(verifiedTargetPage, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
          });

          if (!pageRes.ok) continue;

          const html = await pageRes.text();
          const $ = cheerio.load(html);

          $("header, footer, nav, aside, [id*='footer'], [id*='header'], .blog, .post, [class*='blog']").remove();

          const candidateCards = $(
            "li.product, div.product, article.product, div[class*='product-card'], div[class*='product-item'], div[class*='type-product'], a[href*='/product/'], a[href*='/products/']"
          ).toArray();

          const batch = candidateCards.slice(0, 24);

          for (let i = 0; i < batch.length; i++) {
            const $card = $(batch[i]);

            const title = $card
              .find("h2, h3, h4, .woocommerce-loop-product__title, [class*='title'], [class*='name']")
              .first()
              .text()
              .trim();

            if (!title || title.length < 3) continue;

            const lowerTitle = title.toLowerCase();
            if (bannedTitles.includes(lowerTitle)) continue;

            // Link extraction
            const extractedHref: string | undefined = $card.is("a")
              ? $card.attr("href")
              : $card.find("a").first().attr("href");

            let fullProductUrl: string = safeBaseUrl;

            if (extractedHref) {
              try {
                const absolute = /^https?:\/\//i.test(extractedHref)
                  ? extractedHref
                  : new URL(extractedHref, safeBaseUrl).href;

                fullProductUrl = getSafeFetchUrl(absolute) || safeBaseUrl;
              } catch {
                fullProductUrl = safeBaseUrl;
              }
            }

            if (
              /\/(blog|post|article|news|policy|privacy|terms|about|contact)(\/|$)/i.test(
                fullProductUrl
              )
            ) {
              continue;
            }

            let price = extractExactProductPrice($card);
            if (price === 0 && $card.parent().length) {
              price = extractExactProductPrice($card.parent());
            }

            let rawImg = "";
            const imgEl = $card.find("img, picture source").first();
            if (imgEl.is("img")) {
              rawImg =
                imgEl.attr("data-large_image") ||
                imgEl.attr("data-src") ||
                imgEl.attr("data-lazy-src") ||
                imgEl.attr("src") ||
                "";
            } else if (imgEl.is("source")) {
              rawImg = imgEl.attr("srcset") || "";
            }

            if (!rawImg) {
              const styleAttr = $card.find("[style*='background']").attr("style") || $card.attr("style") || "";
              const bgMatch = styleAttr.match(/url\(['"]?(.*?)['"]?\)/i);
              if (bgMatch && bgMatch[1]) rawImg = bgMatch[1];
            }

            if (rawImg.includes(",")) rawImg = rawImg.split(",")[0].trim().split(" ")[0];

            let imgUrl = "";
            if (rawImg && !rawImg.startsWith("data:image")) {
              try {
                const full = rawImg.startsWith("http") ? rawImg : new URL(rawImg, safeBaseUrl).href;
                imgUrl = getSafeFetchUrl(full) || "";
              } catch {}
            }

            let detailSku = "";
            if ((!imgUrl || price === 0) && fullProductUrl !== safeBaseUrl) {
              const details = await scrapeDetailPage(fullProductUrl);
              if (details) {
                if (!imgUrl && details.image) imgUrl = details.image;
                if (price === 0 && details.price > 0) price = details.price;
                if (details.sku) detailSku = details.sku;
              }
            }

            if (price <= 0 || !imgUrl) {
              continue;
            }

            if (seenNames.has(title)) continue;
            seenNames.add(title);

            let category = "General";
            if (lowerTitle.includes("makhana") || lowerTitle.includes("cookie") || lowerTitle.includes("snack")) {
              category = "Snacks & Food";
            } else if (lowerTitle.includes("bed")) {
              category = "Beds";
            } else if (lowerTitle.includes("chair")) {
              category = "Chairs";
            } else if (lowerTitle.includes("table")) {
              category = "Tables";
            } else if (lowerTitle.includes("sofa")) {
              category = "Sofas";
            }

            const cardText = $card.text();
            const skuMatch = cardText.match(/WP-\d{4}/i);
            const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
            const sku = detailSku || (skuMatch ? skuMatch[0].toUpperCase() : `PROD-${cleanSlug}`);

            productsToInsert.push({
              user_id: userId,
              name: title,
              description: `Fresh, premium quality ${title}.`,
              price: price,
              category: category,
              image_url: imgUrl,
              product_url: fullProductUrl,
              website_url: fullProductUrl,
              sku: sku,
              stock: "20",
              attributes: { option: ["Standard"] },
              required_fields: [],
              product_type: "website",
            });
          }
        } catch {}
      }
    }

    if (productsToInsert.length === 0) {
      return NextResponse.json({ error: "No valid products could be extracted." }, { status: 400 });
    }

    let successCount = 0;
    for (const prod of productsToInsert) {
      const { error } = await supabase.from("products").upsert(prod, {
        onConflict: "user_id,sku",
      });

      if (!error) {
        successCount++;
      } else {
        console.warn(`Skipping item "${prod.name}":`, error.message);
      }
    }

    return NextResponse.json({
      success: true,
      count: successCount,
      message: `Successfully synced ${successCount} products!`,
    });
  } catch (err: any) {
    console.error("Sync route error:", err);
    return NextResponse.json({ error: err.message || "Failed to sync website" }, { status: 500 });
  }
}