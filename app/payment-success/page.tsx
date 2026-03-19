"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
// 🟢 NEW IMPORT
import { createBrowserClient } from "@supabase/ssr";

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [order, setOrder] = useState<any>(null);

  // 🟢 NEW CLIENT INITIALIZATION
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (orderId) {
      // Extract UUID from "ORD_uuid_timestamp"
      const uuid = orderId.includes('_') ? orderId.split("_")[1] : orderId;
      
      const fetchOrder = async () => {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", uuid)
          .single();
          
        if (data) setOrder(data);
        if (error) console.error("Error fetching order:", error);
      };
      fetchOrder();
    }
  }, [orderId, supabase]);

  if (!order) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
       <p className="mt-4 text-gray-600">Verifying your payment...</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-lg border border-green-100 text-center">
      <div className="mb-4 text-green-500">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-800">Payment Successful!</h1>
      <p className="text-gray-500 mt-2">Order ID: {orderId}</p>
      
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
        <div className="flex justify-between py-2 border-b">
          <span className="text-gray-600">Product:</span>
          <span className="font-medium text-gray-900">{order.product_name}</span>
        </div>
        <div className="flex justify-between py-2 border-b">
          <span className="text-gray-600">Amount Paid:</span>
          <span className="font-medium text-gray-900">₹{order.price}</span>
        </div>
        <div className="flex justify-between py-2">
          <span className="text-gray-600">Status:</span>
          <span className="text-green-600 font-bold uppercase">{order.payment_status}</span>
        </div>
      </div>

      <button 
        onClick={() => window.location.href = '/dashboard'}
        className="w-full mt-8 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        Go to Dashboard
      </button>
    </div>
  );
}