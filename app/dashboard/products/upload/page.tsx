"use client";
import Papa from "papaparse";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";


export default function UploadProductsPage() {
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      setMessage("");

      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

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

const products = (parsed.data as any[]).map((row) => ({
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
  user_id: user.id,
}));

console.log("Products to insert:", products);

const { error } = await supabase
  .from("products")
  .insert(products);

if (error) {
  console.error(error);
  setMessage(error.message);
  return;
}

      setMessage(
        `Successfully imported ${products.length} products.`
      );

      setTimeout(() => {
        router.push("/dashboard/products");
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage("Failed to upload CSV.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        Upload Products CSV
      </h1>

      <p className="text-gray-600 mb-6">
        Upload a CSV file containing your products.
      </p>

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
            <p className="text-sm text-gray-500">
              Accepted format: .csv
            </p>
          )}
        </div>

        {message && (
          <div className="mt-6 rounded bg-gray-100 p-3">
            {message}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-xl border bg-gray-50 p-4">
        <p className="font-semibold mb-2">
          Example CSV format
        </p>

        <pre className="text-sm overflow-auto">
{`name,description,price,category,image_url,website_url
Premium Cotton T-Shirt,100% cotton t-shirt,499,Clothing,https://example.com/tshirt.jpg,https://example.com/product/tshirt
Slim Fit Jeans,Premium denim jeans,1899,Clothing,https://example.com/jeans.jpg,https://example.com/product/jeans`}
        </pre>
      </div>
    </div>
  );
}