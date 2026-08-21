"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function RazorpayOrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId =
    searchParams.get("order_id") ||
    searchParams.get("razorpay_payment_link_reference_id");
  const paymentId = searchParams.get("razorpay_payment_id");

  const [order, setOrder] = useState<any>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrderAndStoreUrl() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      // 1. Fetch order details from Supabase
      const { data: orderData } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderData) {
        setOrder(orderData);

        // 2. Fetch the merchant's store website URL only
        if (orderData.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("website_url, store_url, domain")
            .eq("id", orderData.user_id)
            .maybeSingle();

          const storeSite =
            profile?.website_url ||
            profile?.store_url ||
            profile?.domain;

          // Only set return URL if a valid custom website exists and it is NOT woodpetra.in
          if (storeSite && !storeSite.includes("woodpetra.in")) {
            const formattedUrl = storeSite.startsWith("http")
              ? storeSite
              : `https://${storeSite}`;
            setReturnUrl(formattedUrl);
          }
        }
      }
      setLoading(false);
    }

    fetchOrderAndStoreUrl();
  }, [orderId]);

  const handleCloseWindow = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 bg-gray-900 rounded-2xl border border-gray-800 text-center shadow-xl">
        {/* Success Icon */}
        <div className="bg-green-100 p-4 rounded-full mb-4 inline-flex">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Order Confirmed!</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Your payment via Razorpay was successful.
        </p>

        {/* Order Details */}
        <div className="bg-gray-800/60 rounded-xl p-4 mb-6 text-left border border-gray-700/50 space-y-2">
          <div className="flex justify-between text-sm py-1 border-b border-gray-700/40">
            <span className="text-gray-400">Order ID:</span>
            <span className="text-white font-mono font-medium">{orderId || "N/A"}</span>
          </div>

          {(paymentId || order?.payment_id) && (
            <div className="flex justify-between text-sm py-1 border-b border-gray-700/40">
              <span className="text-gray-400">Payment ID:</span>
              <span className="text-white font-mono text-xs">
                {paymentId || order?.payment_id}
              </span>
            </div>
          )}

          {(order?.price || order?.total_amount) && (
            <div className="flex justify-between text-sm py-1 border-b border-gray-700/40">
              <span className="text-gray-400">Amount Paid:</span>
              <span className="text-green-400 font-semibold">
                ₹{order?.price || order?.total_amount}
              </span>
            </div>
          )}

          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-400">Payment Gateway:</span>
            <span className="text-blue-400 font-medium">Razorpay</span>
          </div>
        </div>

        <p className="text-emerald-400 text-xs mb-6">
          💬 Confirmation & receipt details have been sent to your WhatsApp number.
        </p>

        {/* Conditional Action: Show 'Return to Store' ONLY if merchant URL exists, otherwise show 'Close Window' */}
        {returnUrl ? (
          <a
            href={returnUrl}
            className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition"
          >
            Return to Store
          </a>
        ) : (
          <button
            onClick={handleCloseWindow}
            className="inline-flex items-center justify-center gap-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 px-8 py-3 rounded-lg font-medium transition border border-gray-700"
          >
            <X className="w-4 h-4" />
            Close Tab
          </button>
        )}
      </div>
    </div>
  );
}

export default function RazorpayOrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white text-sm">
          Loading order details...
        </div>
      }
    >
      <RazorpayOrderSuccessContent />
    </Suspense>
  );
}