"use client";

import { useSearchParams } from "next/navigation";

export default function OrderSuccess() {
  const params = useSearchParams();
  const orderId = params.get("order_id");

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">✅ Payment Successful</h1>
        <p>Order ID: {orderId}</p>
        <p className="mt-2">Thank you for your purchase 🎉</p>
      </div>
    </div>
  );
}