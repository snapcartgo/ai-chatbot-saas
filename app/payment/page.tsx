import { Suspense } from "react";
import PaymentClient from "./PaymentClient";

export default function PaymentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white shadow-xl rounded-xl p-8 w-[420px]">

        <h1 className="text-2xl font-bold mb-2 text-center">
          Complete Your Payment
        </h1>

        <p className="text-center text-gray-500 mb-6">
          Starter Plan
        </p>

        <div className="text-center mb-6">
          <h2 className="text-4xl font-bold text-blue-600">
            ₹999
          </h2>
        </div>

        <ul className="mb-6 text-gray-600 space-y-2">
          <li>✅ 500 AI messages</li>
          <li>✅ 1 Chatbot</li>
          <li>✅ Email support</li>
        </ul>

        <div className="space-y-3">

          <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
            Pay with PayPal
          </button>

          <button className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
            Pay with PayU
          </button>

        </div>

      </div>

    </div>
  )
}