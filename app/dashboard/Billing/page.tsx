"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function BillingPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? null);
    };
    getUser();
  }, []);

  // 🔥 COMMON HANDLER
  const handlePayment = (
    planId: string,
    price: number,
    gateway: "payu" | "paypal"
  ) => {
    if (!userEmail) {
      alert("User not logged in ❌");
      return;
    }

    // ✅ Redirect to backend API
    window.location.href = `/api/${gateway}?plan=${planId}&email=${userEmail}&amount=${price}`;
  };

  const plans = [
    {
      name: "Starter",
      price: 499,
      description: "Basic chatbot plan",
      messages: "100 Messages",
      bots: "1 Chatbot",
      planId: "starter",
    },
    {
      name: "Pro",
      price: 1999,
      description: "Advanced chatbot plan",
      messages: "5000 Messages",
      bots: "5 Chatbots",
      planId: "pro",
    },
    {
      name: "Growth",
      price: 4999,
      description: "Best for businesses",
      messages: "20000 Messages",
      bots: "20 Chatbots",
      planId: "growth",
    },
  ];

  return (
    <div className="p-10 bg-black min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-2">Billing Plans</h1>
      <p className="text-gray-400 mb-8">
        Choose the plan that fits your business needs.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="border border-gray-800 rounded-2xl p-8 bg-gray-900 flex flex-col"
          >
            <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>

            <p className="text-blue-500 font-bold text-xl mb-4">
              ₹{plan.price}
            </p>

            <p className="text-gray-400 mb-6 text-sm">
              {plan.description}
            </p>

            <div className="space-y-3 mb-8 text-sm text-gray-300 flex-grow">
              <p>✅ {plan.messages}</p>
              <p>✅ {plan.bots}</p>
            </div>

            {/* 🔥 PAYU BUTTON */}
            <button
              onClick={() =>
                handlePayment(plan.planId, plan.price, "payu")
              }
              className="w-full bg-blue-600 py-3 rounded-xl font-bold mb-3 hover:bg-blue-700 transition"
            >
              Pay with PayU
            </button>

            {/* 🔥 PAYPAL BUTTON */}
            <button
              onClick={() =>
                handlePayment(plan.planId, plan.price, "paypal")
              }
              className="w-full border border-gray-700 py-3 rounded-xl font-bold hover:bg-gray-800 transition"
            >
              Pay with PayPal
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}