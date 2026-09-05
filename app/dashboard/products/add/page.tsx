"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AddProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitCount, setLimitCount] = useState(5);

  const handleSave = async () => {
    try {
      setLoading(true);

      if (!name || !price || !description || !category || !image) {
        alert("Please fill all fields");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User session not found. Please log in again.");
        return;
      }

      // 🟢 PRODUCT LIMIT CHECK START
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("product_limit")
        .eq("user_id", user.id)
        .maybeSingle();

      const limit = sub?.product_limit ?? 5; // Default fallback to 5

      if (limit !== -1) {
        const { count } = await supabase
          .from("products")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("product_type", "meta"); // 🟢 Only count website products

        if (count !== null && count >= limit) {
          setLimitCount(limit);
          setShowLimitModal(true);
          setLoading(false);
          return;
        }
      }
      // 🟢 PRODUCT LIMIT CHECK END

      const fileName = `${Date.now()}-${image.name}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, image);

      if (uploadError) {
        console.log(uploadError);
        alert("Image upload failed");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const imageUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase.from("products").insert([
        {
          user_id: user.id,
          name,
          price: Number(price),
          description,
          category,
          image_url: imageUrl,
          website_url: websiteUrl.trim() || null,
          product_type: "website", // 🟢 Tag as website product
        },
      ]);

      if (dbError) {
        console.log(dbError);
        alert("Failed to save product");
        return;
      }

      alert("Product saved successfully");

      setName("");
      setPrice("");
      setDescription("");
      setCategory("");
      setWebsiteUrl("");
      setImage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.push("/dashboard/products");
      router.refresh();
    } catch (error) {
      console.log(error);
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
          Website Product
        </p>
        <h1 className="text-4xl font-extrabold mt-2 text-gray-900">
          Add Product
        </h1>
        <p className="text-gray-500 mt-3 text-sm">
          Add your product details, website link, and image for catalog display.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="block mb-2 font-medium text-gray-800">
            Product Name
          </label>

          <input
            type="text"
            placeholder="Enter product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-800">
            Price
          </label>

          <input
            type="number"
            placeholder="Enter price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-800">
            Description
          </label>

          <textarea
            placeholder="Enter description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-xl h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-800">
            Category
          </label>

          <input
            type="text"
            placeholder="Enter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block mb-2 font-medium text-gray-800">
            Website URL
          </label>

          <input
            type="url"
            placeholder="https://yourwebsite.com/product-name"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full border border-gray-300 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            Add the direct product page or buy-now link for your website.
          </p>
        </div>

        <div>
          <label className="block mb-3 font-medium text-gray-800">
            Product Image
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Upload Product Image
            </button>

            <div className="text-sm text-gray-600">
              {image ? image.name : "No file chosen"}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Recommended: square product image with clear background or clean product photo.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full rounded-2xl bg-black px-6 py-4 text-white font-bold transition-colors hover:bg-gray-900 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Product"}
        </button>
      </div>
      {/* 🟢 PASTE HERE */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-2xl font-bold">
              !
            </div>
            <h3 className="text-xl font-bold text-gray-900">Product Limit Reached</h3>
            <p className="mt-2 text-sm text-gray-600">
              You have reached your plan limit of <strong>{limitCount} website products</strong>.
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Please{" "}
              <Link
                href="/dashboard/Billing"
                className="font-bold text-blue-600 underline hover:text-blue-800"
              >
                upgrade your plan
              </Link>{" "}
              to add more products.
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <Link
                href="/dashboard/Billing"
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Go to Billing
              </Link>
            </div>
          </div>
        </div>
      )}

    
    </div>
  );
}