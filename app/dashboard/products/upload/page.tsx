"use client";
import Papa from "papaparse";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function UploadProductsPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setMessage("");
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessage("Please log in first."); return; }

      const text = await file.text();
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      // CORE CHANGE: Map data dynamically
      const products = (parsed.data as any[]).map((row) => {
        // 1. Separate base fields from dynamic attributes
        const baseKeys = ["name", "description", "price", "category", "image_url", "website_url", "product_url", "stock", "payment_link", "currency", "sku"];
        
        const attributes: Record<string, any> = {};
        
        // 2. Everything that isn't a base field gets pushed to 'attributes'
        Object.keys(row).forEach((key) => {
          if (!baseKeys.includes(key) && row[key] !== "") {
            attributes[key] = row[key];
          }
        });

        // 3. Return object ready for Supabase JSONB
        return {
          name: row.name?.trim() || "",
          description: row.description?.trim() || "",
          price: Number(row.price ?? 0),
          category: row.category?.trim() || "",
          image_url: row.image_url?.trim() || "",
          website_url: row.website_url?.trim() || "",
          product_url: row.product_url?.trim() || "",
          stock: Number(row.stock ?? 0),
          payment_link: row.payment_link?.trim() || "",
          currency: row.currency?.trim() || "INR",
          sku: row.sku?.trim() || "",
          attributes: attributes, // <--- This JSONB object
          user_id: user.id,
        };
      });

      const { error } = await supabase.from("products").insert(products);

      if (error) throw error;

      setMessage(`Successfully imported ${products.length} products.`);
      setTimeout(() => router.push("/dashboard/products"), 1500);
      
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Failed to upload CSV.");
    } finally {
      setUploading(false);
    }
  };

  // ... (rest of your return JSX remains the same)
}