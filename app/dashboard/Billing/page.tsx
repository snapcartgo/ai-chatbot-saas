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

  const handlePayment = (
    planId: string,
    price: number,
    gateway: "payu" | "paypal"
  ) => {
    if (!userEmail) {
      alert("User not logged in ❌");
      return;
    }

    window.location.href = `/api/${gateway}?plan=${planId}&email=${userEmail}&amount=${price}`;
  };

  const plans = [
      {
        name: "Starter",
        price: 999,
        description: "Perfect for getting started",
        messages: "100 AI Messages / month",
        bots: "1 AI Chatbot",
        knowledgeBase: "10 MB",
        features: [
          "Capture Leads Automatically",
          "View Conversations Dashboard",
          "Simple Auto-Reply Workflow",
          "Email Support",
        ],
        planId: "starter",
      },
      {
        name: "Pro",
        price: 1999,
        description: "Scale your customer engagement",
        messages: "3000 AI Messages / month",
        bots: "2 AI Chatbots",
        knowledgeBase: "50 MB",
        features: [
          "Advanced Lead Capture + Pipeline",
          "Full Conversation History",
          "Smart Follow-ups & Automation",
          "Analytics Dashboard",
          "Priority Email Support",
        ],
        planId: "pro",
      },
      {
        name: "Growth",
        price: 4999,
        description: "Built for serious businesses",
        messages: "12000 AI Messages / month",
        bots: "5 AI Chatbots",
        knowledgeBase: "100 MB",
        features: [
          "Advanced CRM (Leads + Pipeline + Orders)",
          "Auto Lead Assignment",
          "Advanced Automation Workflows",
          "Cart Recovery & Follow-ups",
          "Advanced Analytics & Conversion Tracking",
          "Priority Support + Faster Response",
        ],
        planId: "growth",
      },
    ];

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white w-full">

      {/* HEADER */}
      <h1 className="text-xl md:text-3xl font-bold mb-2">
        Billing Plans
      </h1>

      <p className="text-gray-400 mb-6 md:mb-8 text-sm md:text-base">
        Choose the plan that fits your business needs.
      </p>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">

        {plans.map((plan) => (
          <div
            key={plan.name}
            className="border border-gray-800 rounded-2xl p-5 md:p-6 bg-gray-900 flex flex-col"
          >

            {/* TITLE */}
            <h2 className="text-lg md:text-2xl font-bold mb-1">
              {plan.name}
            </h2>

            {/* PRICE */}
            <p className="text-blue-500 font-bold text-lg md:text-xl mb-3">
              ₹{plan.price}
            </p>

            {/* DESC */}
            <p className="text-gray-400 mb-5 text-xs md:text-sm">
              {plan.description}
            </p>

            {/* FEATURES */}
            <div className="space-y-2 mb-6 text-xs md:text-sm text-gray-300 flex-grow">
              <p>✅ {plan.messages}</p>
              <p>✅ {plan.bots}</p>
            </div>

            {/* PAYU */}
            <button
              onClick={() =>
                handlePayment(plan.planId, plan.price, "payu")
              }
              className="w-full bg-blue-600 py-2 md:py-3 rounded-xl font-bold mb-2 hover:bg-blue-700 transition text-sm md:text-base"
            >
              Pay with PayU
            </button>

            {/* PAYPAL */}
            <button
              onClick={() =>
                handlePayment(plan.planId, plan.price, "paypal")
              }
              className="w-full border border-gray-700 py-2 md:py-3 rounded-xl font-bold hover:bg-gray-800 transition text-sm md:text-base"
            >
              Pay with PayPal
            </button>

          </div>
        ))}

      </div>
    </div>
  );
}