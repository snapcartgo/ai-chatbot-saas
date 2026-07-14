// app/dashboard/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  created_at?: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
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
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.log(error);
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(product.id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User session not found. Please log in again.");
        router.push("/login");
        return;
      }

      const { error: deleteDbError } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id)
        .eq("user_id", user.id);

      if (deleteDbError) {
        console.log(deleteDbError);
        alert("Failed to delete product");
        return;
      }

      if (product.image_url) {
        const storagePath = getStoragePathFromUrl(product.image_url);

        if (storagePath) {
          const { error: storageDeleteError } = await supabase.storage
            .from("product-images")
            .remove([storagePath]);

          if (storageDeleteError) {
            console.log(storageDeleteError);
          }
        }
      }

      setProducts((prev) => prev.filter((item) => item.id !== product.id));
      alert("Product deleted successfully");
    } catch (error) {
      console.log(error);
      alert("Something went wrong while deleting product");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Product Catalog
          </p>
          <h1 className="mt-2 text-4xl font-extrabold text-gray-900">
            Products
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage your website products, links, and images from one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/products/add">
            <button className="rounded-xl bg-black px-5 py-3 font-bold text-white transition hover:bg-gray-900">
              Add Product
            </button>
          </Link>

          {/* Sync Meta Catalog route link button */}
          <Link href="/dashboard/products/sync-meta">
            <button className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700">
              Sync Meta Catalog
            </button>
          </Link>

          <Link href="/dashboard/products/upload">
            <button className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700">
              Upload CSV
            </button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-500 shadow-sm">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">No products yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Add your first product to start building your product catalog.
          </p>
          <Link href="/dashboard/products/add">
            <button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700">
              Add First Product
            </button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {product.name}
                  </h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {product.category}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-7 text-gray-600">
                  {product.description}
                </p>

                <p className="mt-4 text-2xl font-extrabold text-black">
                  ₹{product.price}
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={`/dashboard/products/edit/${product.id}`}>
                    <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
                      Edit
                    </button>
                  </Link>

                  <button
                    onClick={() => handleDelete(product)}
                    disabled={deletingId === product.id}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingId === product.id ? "Deleting..." : "Delete"}
                  </button>

                  {product.website_url ? (
                    <a
                      href={product.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800 transition hover:bg-gray-100"
                    >
                      Visit Website
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}