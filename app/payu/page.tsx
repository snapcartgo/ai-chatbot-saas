"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function PayUContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [status, setStatus] = useState("fetching");

  useEffect(() => {
    if (!orderId) {
      setStatus("no_id");
      return;
    }

    const startPayment = async () => {
      // 🟢 'maybeSingle' prevents the page from crashing if the data is slightly delayed
      const { data, error } = await supabase
        .from("orders")
        .select("payu_data")
        .eq("id", orderId)
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        setStatus("error");
        return;
      }

      if (data && data.payu_data) {
        // 🟢 AUTO-SUBMIT FORM TO PAYU
        const payu = data.payu_data;
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "https://secure.payu.in/_payment";

        // Loop through the JSON object and create inputs
        Object.entries(payu).forEach(([key, value]) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
      } else {
        // Data exists in DB but hasn't reached the frontend yet (Caching)
        console.log("Waiting for payu_data to propagate...");
        setStatus("retrying");
      }
    };

    startPayment();
    
    // Retry once after 2 seconds if first fetch fails (covers sync delays)
    const timer = setTimeout(() => {
      if (status === "retrying") startPayment();
    }, 2000);

    return () => clearTimeout(timer);
  }, [orderId, status]);

  if (status === "no_id") return <div className="p-10">Invalid Payment Link.</div>;
  if (status === "error") return <div className="p-10 text-red-500">Database connection error.</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <h2 className="mt-6 text-xl font-semibold text-gray-700">
        Securing Payment for Order: <span className="text-blue-600">{orderId}</span>
      </h2>
      <p className="mt-2 text-gray-500 text-sm">Please do not refresh or close this window.</p>
    </div>
  );
}

export default function PayUPage() {
  return (
    <Suspense fallback={<div>Loading Secure Checkout...</div>}>
      <PayUContent />
    </Suspense>
  );
}