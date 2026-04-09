"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function PaymentSuccess() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 bg-gray-900 rounded-2xl border border-gray-800 text-center">
        <div className="bg-green-100 p-4 rounded-full mb-4 inline-flex">
          <CheckCircle className="w-16 h-16 text-green-600" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
        <p className="text-gray-400 mb-8">
          Your plan has been activated and your billing data has been updated.
        </p>

        <Link
          href="/dashboard"
          className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
