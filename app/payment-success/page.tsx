"use client";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function PaymentSuccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-8">
          Thank you for your purchase. Your order is being processed, and you will receive access details via email shortly.
        </p>
        <Link 
          href="/" 
          className="block w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition shadow-md"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}