// app/dashboard/products/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Product {
  product_id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  stock?: string | number; // <-- Added stock field
  sold_count?: number;
  website_url?: string | null;
  user_id: string | null;
  created_at?: string;
  product_type?: string | null; // Keeps track of meta vs website
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // State to manage active filter tab: 'website' or 'meta'
  const [activeTab, setActiveTab] = useState<"website" | "meta">("website");

  // ADD THESE 3 LINES:
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  // ---> ADD HERE <---
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [metaSyncResult, setMetaSyncResult] = useState<{
    imported: number;
    updated: number;
    total: number;
  } | null>(null);
  const [metaSyncError, setMetaSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel("realtime-products-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        async (payload) => {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) return;

          if (payload.eventType === "INSERT") {
            const newProduct = payload.new as Product;
            if (newProduct.user_id === user.id) {
              setProducts((prev) => [newProduct, ...prev]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedProduct = payload.new as Product;
            if (updatedProduct.user_id === user.id) {
              setProducts((prev) =>
                prev.map((item) =>
                  item.product_id === updatedProduct.product_id ? updatedProduct : item
                )
              );
            }
          } else if (payload.eventType === "DELETE") {
            const deletedProduct = payload.old as Product;
            setProducts((prev) =>
              prev.filter((item) => item.product_id !== deletedProduct.product_id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Fetch ALL user products so we can switch views instantly on the frontend
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

  // ADD THIS FUNCTION:
  const handleSyncWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!websiteUrl) return;

    try {
      setIsSyncing(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("User session not found.");
        return;
      }

      const response = await fetch("/api/webhooks/store-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl, userId: user.id }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("Website sync executed successfully!");
        setIsSyncModalOpen(false);
        setWebsiteUrl("");
        fetchProducts();
      } else {
        alert(result.error || "Failed to sync website products.");
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong while syncing.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncMeta = async () => {
    try {
      setIsSyncingMeta(true);
      setMetaSyncError(null);
      setMetaSyncResult(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("User session not found. Please log in again.");
        return;
      }

      const response = await fetch("/api/sync-meta-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMetaSyncResult({
          imported: result.imported ?? 0,
          updated: result.updated ?? 0,
          total: result.total ?? 0,
        });
        setActiveTab("meta");
        fetchProducts();
      } else {
        setMetaSyncError(result.error || "Failed to sync Meta catalog.");
      }
    } catch (err: any) {
      console.error("Meta Sync error:", err);
      setMetaSyncError("Something went wrong while syncing Meta catalog.");
    } finally {
      setIsSyncingMeta(false);
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

  const handleDelete = async (product: any) => {
  const confirmed = window.confirm(
    `Delete "${product.name}"? This action cannot be undone.`
  );

  if (!confirmed) return;

  // Use product_id or fall back to id if defined
  const targetId = product.product_id || product.id;

  try {
    setDeletingId(targetId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("User session not found. Please log in again.");
      router.push("/login");
      return;
    }

    // Updated to check product_id instead of id
    const { error: deleteDbError } = await supabase
      .from("products")
      .delete()
      .eq("product_id", targetId)
      .eq("user_id", user.id);

    if (deleteDbError) {
      console.error("Supabase Delete Error:", deleteDbError);
      alert(`Failed to delete product: ${deleteDbError.message}`);
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

    // Filter out deleted product by product_id
    setProducts((prev) => prev.filter((item: any) => (item.product_id || item.id) !== targetId));
    alert("Product deleted successfully");
  } catch (error) {
    console.log(error);
    alert("Something went wrong while deleting product");
  } finally {
    setDeletingId(null);
  }
};

  // Filter products arrays dynamically based on current selected tab state
  const displayedProducts = products.filter(
    (product) => product.product_type === activeTab
  );

  return (
    <div className="p-6">
      {/* Header Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

          {/* ADD THIS BUTTON */}
  <button
    onClick={() => setIsSyncModalOpen(true)}
    className="rounded-xl bg-purple-600 px-5 py-3 font-bold text-white transition hover:bg-purple-700"
  >
    Sync Website
  </button>

          <button
            onClick={handleSyncMeta}
            disabled={isSyncingMeta}
            className={`rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50`}
          >
            {isSyncingMeta ? "Syncing Meta..." : "Sync Meta Catalog"}
          </button>

          <Link href="/dashboard/products/upload">
            <button className="rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:bg-green-700">
              Upload CSV
            </button>
          </Link>
        </div>
      </div>

      {/* Meta Sync Error Alert */}
      {metaSyncError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {metaSyncError}
        </div>
      )}

      {/* Meta Sync Status Box */}
      {metaSyncResult && (
        <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50/70 p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-900">
            ✓ Catalog Synchronized Successfully
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Imported</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{metaSyncResult.imported}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Updated</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{metaSyncResult.updated}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Total Items</p>
              <p className="mt-1 text-xl font-extrabold text-blue-600">{metaSyncResult.total}</p>
            </div>
          </div>
        </div>
      )}

      {/* --- FILTER BUTTONS POSITIONED UNDER THE HEADER DESCRIPTION --- */}
      <div className="mb-8 flex gap-4 border-b border-gray-200 pb-4">
        <button
          onClick={() => setActiveTab("website")}
          className={`rounded-xl px-6 py-2.5 font-bold transition-all ${
            activeTab === "website"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Website Products
        </button>

        <button
          onClick={() => setActiveTab("meta")}
          className={`rounded-xl px-6 py-2.5 font-bold transition-all ${
            activeTab === "meta"
              ? "bg-blue-600 text-white shadow-md shadow-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Meta Products
        </button>
      </div>

      {/* Grid Content Wrapper */}
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-gray-500 shadow-sm">
          Loading products...
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900">
            No {activeTab === "website" ? "Website" : "Meta"} products found
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            There are currently no items under this tab selection.
          </p>
          {activeTab === "website" && (
            <Link href="/dashboard/products/add">
              <button className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700">
                Add First Product
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {displayedProducts.map((product) => (
            <div
              key={product.product_id}
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

                {/* Stock & Sold Section */}
  <div className="mt-3 flex items-center justify-between text-xs font-semibold">
    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      📦 {product.stock ?? 20} items left
    </span>
    <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-blue-700 ring-1 ring-inset ring-blue-700/10">
      🔥 {product.sold_count ?? 0} sold
    </span>
  </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={`/dashboard/products/edit/${product.product_id}`}>
                    <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700">
                      Edit
                    </button>
                  </Link>

                  <button
  onClick={() => handleDelete(product)}
  disabled={deletingId === product.product_id}
  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
>
  {deletingId === product.product_id ? "Deleting..." : "Delete"}
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
      {/* ADD THIS MODAL BEFORE THE LAST </div> */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900">Sync Ecommerce Store</h2>
            <p className="mt-1 text-sm text-gray-500">
              Paste your store link to extract products automatically.
            </p>

            <form onSubmit={handleSyncWebsite} className="mt-4">
              <input
                type="url"
                required
                placeholder="https://yourstore.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-blue-600 focus:outline-none"
              />

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSyncModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSyncing ? "Syncing..." : "Start Sync"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    
    </div>
  );
}