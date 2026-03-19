"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

// 1️⃣ Create a sub-component for the content
function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");
  const [order, setOrder] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (orderId) {
      const uuid = orderId.includes('_') ? orderId.split("_")[1] : orderId;
      
      const fetchOrder = async () => {
        const { data } = await supabase
          .from("orders")
          .select("*")
          .eq("id", uuid)
          .single();
        if (data) setOrder(data);
      };
      fetchOrder();
    }
  }, [orderId, supabase]);

  if (!order) return <div className="text-center p-10">Loading receipt...</div>;

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-lg border border-green-100 text-center">
      <div className="mb-4 text-green-500 text-4xl">✅</div>
      <h1 className="text-2xl font-bold text-gray-800">Payment Successful!</h1>
      <p className="text-gray-500 mt-2">Order: {order.product_name}</p>
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left text-sm">
        <p><strong>Amount:</strong> ₹{order.price}</p>
        <p><strong>Status:</strong> {order.payment_status}</p>
      </div>
      <button 
        onClick={() => window.location.href = '/dashboard'}
        className="w-full mt-8 bg-blue-600 text-white py-3 rounded-lg"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

// 2️⃣ Wrap the content in Suspense in the main export
export default function PaymentSuccess() {
  return (
    <Suspense fallback={<div className="text-center p-10">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}