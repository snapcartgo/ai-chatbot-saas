"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  website_url?: string | null;
  user_id: string | null;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = String(params.id);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const getStoragePathFromUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      const marker = "/storage/v1/object/public/product-images/";
      const index = parsedUrl.pathname.indexOf(marker);

      if (index === -1) return null;

      return decodeURIComponent(parsedUrl.pathname.slice(index + marker.length));
    } catch {
      return null;
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        console.log(error);
        alert("Product not found");
        router.push("/dashboard/products");
        return;
      }

      const product = data as Product;

      setName(product.name || "");
      setPrice(String(product.price ?? ""));
      setDescription(product.description || "");
      setCategory(product.category || "");
      setWebsiteUrl(product.website_url || "");
      setCurrentImageUrl(product.image_url || "");
    } catch (error) {
      console.log(error);
      alert("Failed to load product");
      router.push("/dashboard/products");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      setSaving(true);

      if (!name || !price || !description || !category) {
        alert("Please fill all required fields");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User session not found. Please log in again.");
        router.push("/login");
        return;
      }

      let imageUrl = currentImageUrl;

      if (image) {
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

        imageUrl = publicUrlData.publicUrl;

        if (currentImageUrl) {
          const oldStoragePath = getStoragePathFromUrl(currentImageUrl);

          if (oldStoragePath) {
            const { error: removeError } = await supabase.storage
              .from("product-images")
              .remove([oldStoragePath]);

            if (removeError) {
              console.log(removeError);
            }
          }
        }
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          name,
          price: Number(price),
          description,
          category,
          image_url: imageUrl,
          website_url: websiteUrl.trim() || null,
        })
        .eq("id", productId)
        .eq("user_id", user.id);

      if (updateError) {
        console.log(updateError);
        alert("Failed to update product");
        return;
      }

      alert("Product updated successfully");
      router.push("/dashboard/products");
      router.refresh();
    } catch (error) {
      console.log(error);
      alert("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-500 shadow-sm">
          Loading product...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Product Catalog
          </p>
          <h1 className="mt-2 text-4xl font-extrabold text-gray-900">
            Edit Product
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Update your product details, image, and website link.
          </p>
        </div>

        <Link href="/dashboard/products">
          <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800 transition hover:bg-gray-100">
            Back
          </button>
        </Link>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <label className="mb-2 block font-medium text-gray-800">
            Product Name
          </label>
          <input
            type="text"
            placeholder="Enter product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block font-medium text-gray-800">Price</label>
          <input
            type="number"
            placeholder="Enter price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block font-medium text-gray-800">
            Description
          </label>
          <textarea
            placeholder="Enter description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-32 w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block font-medium text-gray-800">
            Category
          </label>
          <input
            type="text"
            placeholder="Enter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-2 block font-medium text-gray-800">
            Website URL
          </label>
          <input
            type="url"
            placeholder="https://yourwebsite.com/product-name"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="w-full rounded-xl border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-3 block font-medium text-gray-800">
            Product Image
          </label>

          {currentImageUrl ? (
            <div className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
              <img
                src={currentImageUrl}
                alt={name}
                className="h-56 w-full object-cover"
              />
            </div>
          ) : null}

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
              {image ? image.name : "No new file chosen"}
            </div>
          </div>
        </div>

        <button
          onClick={handleUpdate}
          disabled={saving}
          className="w-full rounded-2xl bg-black px-6 py-4 font-bold text-white transition-colors hover:bg-gray-900 disabled:opacity-60"
        >
          {saving ? "Updating..." : "Update Product"}
        </button>
      </div>
    </div>
  );
}