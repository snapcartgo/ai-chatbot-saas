"use client";

import { useSearchParams } from "next/navigation";

export default function PaymentPage() {

  const params = useSearchParams();
  const plan = params.get("plan");

  const plans: any = {
    starter: { price: "₹999", messages: "500 AI messages", bots: "1 chatbot" },
    pro: { price: "₹1999", messages: "2000 AI messages", bots: "3 chatbots" },
    growth: { price: "₹4999", messages: "5000 AI messages", bots: "10 chatbots" }
  };

  const selectedPlan = plan ? plans[plan] : null;

  if (!selectedPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-xl font-semibold">No plan selected</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">

      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">

        <h1 className="text-2xl font-bold mb-2 text-center">
          Complete Your Payment
        </h1>

        <p className="text-gray-500 text-center mb-6">
          Secure checkout for your subscription
        </p>

        <div className="border rounded-lg p-5 mb-6 bg-gray-50">

          <h2 className="text-lg font-semibold mb-2 capitalize">
            {plan} Plan
          </h2>

          <p className="text-2xl font-bold mb-2">
            {selectedPlan.price}
          </p>

          <ul className="text-sm text-gray-600 space-y-1">
            <li>• {selectedPlan.messages}</li>
            <li>• {selectedPlan.bots}</li>
          </ul>

        </div>

        <div className="space-y-4">

          <button
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 rounded-lg"
            onClick={() => window.location.href = "/api/paypal?plan=" + plan}
          >
            Pay with PayPal
          </button>

          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
            onClick={() => window.location.href = "/api/payu?plan=" + plan}
          >
            Pay with PayU
          </button>

        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Payments are secure and encrypted.
        </p>

      </div>

    </div>
  );
}