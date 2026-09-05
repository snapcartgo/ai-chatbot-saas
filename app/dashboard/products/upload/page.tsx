"use client";
import Papa from "papaparse";
import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";


export default function UploadProductsPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<ReactNode>("");

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setMessage("");
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMessage("Please log in first.");
        return;
      }

      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

     

      const products = (parsed.data as any[]).map((row) => {
  console.log("Current row:", row);
  console.log("Currency:", row.currency);

  return {
    name: row.name?.trim() || "",
    description: row.description?.trim() || "",
    price: Number(row.price ?? 0),
    category: row.category?.trim() || "",
    image_url: row.image_url?.trim() || "",
    website_url: row.website_url?.trim() || "",
    product_url: row.product_url?.trim() || "",
    color: row.color?.trim() || "",
    size: row.size?.trim() || "",
    stock: Number(row.stock ?? 0),
    payment_link: row.payment_link?.trim() || "",
    currency: row.currency?.trim() || "INR",
    sku: row.sku?.trim() || "",
    product_type: "website", // 🟢 Ensure CSV items are tagged as website
    required_fields:
      typeof row.required_fields === "string" &&
      row.required_fields.trim() !== ""
        ? JSON.parse(row.required_fields)
        : [],
    attributes:
      typeof row.attributes === "string" &&
      row.attributes.trim() !== ""
        ? JSON.parse(row.attributes)
        : {},
    user_id: user.id,
  };
});

      console.log("Products to insert:", products);

      // 🟢 PRODUCT LIMIT CHECK START
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("product_limit")
        .eq("user_id", user.id)
        .maybeSingle();

      const limit = sub?.product_limit ?? 5; // Default fallback to 5

      if (limit !== -1) {
        // 🟢 Filter by user_id AND exclude meta products
        const { count: currentCount } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("product_type", "meta"); // <-- Only count website products

        const current = currentCount || 0;
        const totalAfter = current + products.length;

        if (totalAfter > limit) {
          const availableSlots = Math.max(0, limit - current);
          setMessage(
            <span>
              Limit reached! Your plan allows up to {limit} website products. You currently have {current} website products and can only add {availableSlots} more. Please{" "}
              <Link
                href="/dashboard/Billing"
                className="font-bold text-blue-600 underline hover:text-blue-800"
              >
                upgrade your plan
              </Link>
              .
            </span>
          );
          setUploading(false);
          return;
        }
      }

        
      // 🟢 PRODUCT LIMIT CHECK END

      const { error } = await supabase.from("products").insert(products);

      if (error) {
        console.error(error);
        setMessage(error.message);
        return;
      }

      setMessage(`Successfully imported ${products.length} products.`);
      setTimeout(() => {
        router.push("/dashboard/products");
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setMessage("Failed to upload CSV. Please ensure attributes are in valid JSON format.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Upload Products CSV</h1>
      <p className="text-gray-600 mb-6">Upload a CSV file containing your products.</p>

      <div className="border rounded-xl p-6 bg-white shadow">
        <input
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={uploading}
        />

        <div className="mt-6">
          {uploading ? (
            <p>Uploading...</p>
          ) : (
            <p className="text-sm text-gray-500">Accepted format: .csv</p>
          )}
        </div>

        {message && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {message}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border bg-gray-50 p-4">
  <p className="font-semibold mb-2">Example CSV format</p>

  <pre className="text-sm overflow-auto">
    {`name,description,price,category,image_url,website_url,product_url,stock,currency,payment_link,sku,color,size,required_fields,attributes
"Tiger Eye Bracelet","Natural Tiger Eye Bracelet",799,"Bracelets","https://example.com/images/tiger.jpg","https://woodpetra.in","https://woodpetra.in/products/tiger-eye",25,"INR","","TE-001","Brown","8mm","[""color"",""size""]","{""color"":[""Brown""],""size"":[""8mm""]}"`}
  </pre>
</div>

<div className="mt-6 flex justify-center">
  <a
    href="/product-template.csv"
    download
    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-medium shadow-md transition hover:bg-blue-700 hover:shadow-lg"
  >
    📥 Download CSV Template
  </a>
</div>
    </div>
  );
}