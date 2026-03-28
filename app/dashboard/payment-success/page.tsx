"use client";

import Link from 'next/link';
import { CheckCircle } from 'lucide-react'; // If you use lucide-react, otherwise use an SVG

export default function PaymentSuccess() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="bg-green-100 p-4 rounded-full mb-4">
        <CheckCircle className="w-16 h-16 text-green-600" />
      </div>
      
      <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
      <p className="text-gray-400 mb-8 max-w-md">
        Thank you for your purchase. Your account has been upgraded, and you can now access your new features.
      </p>

      <div className="flex gap-4">
        <Link 
          href="/dashboard" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
        >
          Go to Dashboard
        </Link>
        <Link 
          href="/dashboard/Chatbots" 
          className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition"
        >
          Create Chatbot
        </Link>
      </div>
    </div>
  );
}