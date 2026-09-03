import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import dns from "dns/promises";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Checks whether an IP address is in a private, loopback, or metadata subnet
 */
function isDisallowedIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;

  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
    const [b0, b1] = parts;
    if (b0 === 10) return true; // 10.0.0.0/8
    if (b0 === 127) return true; // 127.0.0.0/8
    if (b0 === 0) return true; // 0.0.0.0/8
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12
    if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16
    if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 (AWS metadata)
    return false;
  }

  // Treat all unhandled IPv6 as disallowed for scraping targets
  return true;
}

/**
 * Validates domain and performs DNS lookup to prove host is an external public IP
 */
async function getValidatedSafeUrl(urlString: string): Promise<URL | null> {
  if (!urlString || typeof urlString !== "string") return null;

  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname || hostname.length > 253 || hostname.includes(" ")) return null;

    // Check against internal domain patterns
    const blockedSuffixes = [".local", ".internal", ".lan", ".home", ".corp"];
    if (blockedSuffixes.some((s) => hostname.endsWith(s))) return null;

    // Resolve DNS and test actual network IP
    const { address } = await dns.lookup(hostname);
    if (isDisallowedIp(address)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function sanitizeText(htmlContent: string): string {
  if (!htmlContent) return "";
  const $ = cheerio.load(htmlContent);
  $("script, style").remove();
  return $.text().replace(/\s+/g, " ").trim();
}

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

async function scrapeDetailPage(baseVerifiedUrl: URL, pathAndQuery: string) {
  try {
    const targetUrl = new URL(pathAndQuery, baseVerifiedUrl.origin).href;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(targetUrl, {
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
      image: ogImg ? (ogImg.startsWith("http") ? ogImg : new URL(ogImg, baseVerifiedUrl.origin).href) : "",
      sku: extractedSku,
      price: detailPrice,
    };
  } catch {
    return null;
  }
}

async function fetchShopifyProducts(baseVerifiedUrl: URL, userId: string) {
  try {
    const shopifyEndpoint = new URL("/products.json?limit=100", baseVerifiedUrl.origin).href;
    const res = await fetch(shopifyEndpoint, {
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
        product_url: `${baseVerifiedUrl.origin}/products/${item.handle}`,
        website_url: `${baseVerifiedUrl.origin}/products/${item.handle}`,
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

    const verifiedBaseUrl = await getValidatedSafeUrl(rawWebsiteUrl);
    if (!verifiedBaseUrl) {
      return NextResponse.json({ error: "Invalid or private website target" }, { status: 400 });
    }

    let productsToInsert: any[] = [];

    // 1. Shopify
    const shopifyProds = await fetchShopifyProducts(verifiedBaseUrl, userId);
    if (shopifyProds && shopifyProds.length > 0) {
      productsToInsert = shopifyProds;
    }

    // 2. Dynamic HTML Scraper
    if (productsToInsert.length === 0) {
      const pathsToCrawl = ["/"];
      if (!verifiedBaseUrl.hostname.includes("lovable.app")) {
        pathsToCrawl.push("/shop/");
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

      for (const crawlPath of pathsToCrawl) {
        try {
          const targetUrl = new URL(crawlPath, verifiedBaseUrl.origin).href;
          const pageRes = await fetch(targetUrl, {
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

            const extractedHref = ($card.is("a") ? $card.attr("href") : $card.find("a").first().attr("href")) || "";

            let detailPath = "";
            let fullProductUrl = verifiedBaseUrl.origin;

            if (extractedHref) {
              try {
                const targetObj = new URL(extractedHref, verifiedBaseUrl.origin);
                if (targetObj.hostname === verifiedBaseUrl.hostname) {
                  detailPath = targetObj.pathname + targetObj.search;
                  fullProductUrl = targetObj.href;
                }
              } catch {
                fullProductUrl = verifiedBaseUrl.origin;
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
                imgUrl = rawImg.startsWith("http") ? rawImg : new URL(rawImg, verifiedBaseUrl.origin).href;
              } catch {}
            }

            let detailSku = "";
            if ((!imgUrl || price === 0) && detailPath) {
              const details = await scrapeDetailPage(verifiedBaseUrl, detailPath);
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