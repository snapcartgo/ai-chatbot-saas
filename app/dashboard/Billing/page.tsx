"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GatewayType = "payu" | "paypal" | "razorpay";

const RAZORPAY_LINKS: Record<string, string> = {
  starter: "https://rzp.io/rzp/WS1oIbCc",
  pro: "https://rzp.io/rzp/WS1oIbCc",
  growth: "https://rzp.io/rzp/WS1oIbCc",
  enterprise: "https://rzp.io/rzp/WS1oIbCc",
  whatsapp: "https://rzp.io/rzp/WS1oIbCc",
};

export default function BillingPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isIndia, setIsIndia] = useState(true);

  useEffect(() => {
    const getUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("users")
        .select("country")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Billing user lookup error:", error);
      }

      setIsIndia(data?.country === "India");
    };

    getUserData();
  }, []);

  const handlePayment = (
    planId: string,
    price: number,
    gateway: GatewayType
  ) => {
    if (!userEmail) {
      alert("User not logged in");
      return;
    }

    if (!isIndia && gateway === "payu") {
      alert("PayU is only available in India");
      return;
    }

    if (gateway === "razorpay") {
      const razorpayUrl = RAZORPAY_LINKS[planId];

      if (!razorpayUrl) {
        alert("Razorpay payment link not added for this plan");
        return;
      }

      // FIX: Force open in a new clean window tab to let deep-linking trigger GPay app safely
      window.open(razorpayUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = `/api/${gateway}?plan=${planId}&email=${encodeURIComponent(
      userEmail
    )}&amount=${price}`;
  };

  const handleWhatsAppPayment = (gateway: GatewayType) => {
    if (!userEmail) {
      alert("User not logged in");
      return;
    }

    if (!isIndia && gateway === "payu") {
      alert("PayU is only available in India");
      return;
    }

    if (gateway === "razorpay") {
      const razorpayUrl = RAZORPAY_LINKS.whatsapp;

      if (!razorpayUrl) {
        alert("Razorpay payment link not added for WhatsApp");
        return;
      }

      // FIX: Force open in a new clean window tab to let deep-linking trigger GPay app safely
      window.open(razorpayUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = `/api/${gateway}?plan=whatsapp&email=${encodeURIComponent(
      userEmail
    )}&amount=${isIndia ? 999 : 29}`;
  };

  const plans = [
    {
      name: "Starter",
      price: isIndia ? 999 : 29,
      currency: isIndia ? "₹" : "$",
      description: "Perfect for getting started",
      messages: "1000 AI Messages / month",
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
      price: isIndia ? 1999 : 59,
      currency: isIndia ? "₹" : "$",
      description: "Scale your customer engagement",
      messages: "3000 AI Messages / month",
      bots: "2 AI Chatbots",
      knowledgeBase: "45 MB",
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
      price: isIndia ? 4999 : 99,
      currency: isIndia ? "₹" : "$",
      description: "Built for serious businesses",
      messages: "12000 AI Messages / month",
      bots: "5 AI Chatbots",
      knowledgeBase: "100 MB",
      features: [
        "Advanced CRM (Leads + Pipeline)",
        "Auto Lead Assignment",
        "Advanced Automation Workflows",
        "Cart Recovery & Follow-ups",
        "Advanced Analytics",
        "Priority Support",
      ],
      planId: "growth",
    },
    {
      name: "Enterprise",
      price: isIndia ? 15000 : 299,
      currency: isIndia ? "₹" : "$",
      description: "Advanced Multimodal AI Solution",
      messages: "20000 AI Messages / month",
      bots: "10 AI Chatbots",
      knowledgeBase: "200 MB",
      features: [
        "Instant Image & Voice Understanding",
        "Auto-Detect Multilingual Support",
        "Mindset & Memory Persistence",
        "Advanced CRM (Leads + Orders)",
        "Custom API Integrations",
        "Full Automation Nodes",
      ],
      planId: "enterprise",
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-black p-4 text-white md:p-8">
      <h1 className="mb-2 text-xl font-bold md:text-3xl">Billing Plans</h1>

      <p className="mb-6 text-sm text-gray-400 md:mb-8 md:text-base">
        Choose the plan that fits your business needs.
      </p>

      <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col rounded-2xl border bg-gray-900 p-5 md:p-6 ${
              plan.highlight
                ? "border-blue-500 shadow-lg shadow-blue-500/20"
                : "border-gray-800"
            }`}
          >
            {plan.highlight && (
              <span className="absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                Most Powerful
              </span>
            )}

            <h2 className="mb-1 text-lg font-bold md:text-2xl">{plan.name}</h2>

            <p className="mb-3 text-lg font-bold text-blue-500 md:text-xl">
              {plan.currency}
              {plan.price}
            </p>

            <p className="mb-5 text-xs text-gray-400 md:text-sm">
              {plan.description}
            </p>

            <div className="mb-6 flex-grow space-y-2 text-xs text-gray-300 md:text-sm">
              <p className="font-semibold text-white">✅ {plan.messages}</p>
              <p>✅ {plan.bots}</p>
              <p>✅ Knowledge Base: {plan.knowledgeBase}</p>

              {plan.features.map((feature, index) => (
                <p key={index}>✅ {feature}</p>
              ))}
            </div>

            {/* Razorpay is now displayed for all countries */}
            <button
              onClick={() => handlePayment(plan.planId, plan.price, "razorpay")}
              className="mb-2 w-full rounded-xl bg-green-600 py-2 font-bold hover:bg-green-700 md:py-3"
            >
              Pay with Razorpay
            </button>

            {isIndia && (
              <button
                onClick={() => handlePayment(plan.planId, plan.price, "payu")}
                className={`mb-2 w-full rounded-xl py-2 font-bold transition-opacity md:py-3 ${
                  plan.highlight ? "bg-blue-500" : "bg-blue-600"
                } hover:opacity-90`}
              >
                Pay with PayU
              </button>
            )}

            <button
              onClick={() => handlePayment(plan.planId, plan.price, "paypal")}
              className="w-full rounded-xl border border-gray-700 py-2 font-bold transition-colors hover:bg-gray-800 md:py-3"
            >
              Pay with PayPal
            </button>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-xl rounded-2xl border border-green-700 bg-gray-900 p-6">
        <h2 className="mb-2 text-2xl font-bold text-green-400">
          WhatsApp Automation
        </h2>

        <p className="mb-3 text-xl font-bold text-green-400">
          {isIndia ? "₹999" : "$29"}
        </p>

        <p className="mb-4 text-sm text-gray-400">
          Add WhatsApp chatbot automation to capture leads and automate conversations.
        </p>

        <div className="mb-6 space-y-2 text-sm text-gray-300">
          <p>✅ WhatsApp Chatbot Integration</p>
          <p>✅ Auto Lead Capture</p>
          <p>✅ Auto Replies & Follow-ups</p>
          <p>✅ Conversation Tracking</p>
        </div>

        {/* Razorpay WhatsApp button is now displayed for all countries */}
        <button
          onClick={() => handleWhatsAppPayment("razorpay")}
          className="mb-2 w-full rounded-xl bg-green-500 py-3 font-bold hover:bg-green-600"
        >
          Enable via Razorpay
        </button>

        {isIndia && (
          <button
            onClick={() => handleWhatsAppPayment("payu")}
            className="mb-2 w-full rounded-xl bg-green-600 py-3 font-bold hover:bg-green-700"
          >
            Enable via PayU
          </button>
        )}

        <button
          onClick={() => handleWhatsAppPayment("paypal")}
          className="w-full rounded-xl border border-gray-700 py-3 font-bold hover:bg-gray-800"
        >
          Enable via PayPal
        </button>
      </div>
      {process.env.NODE_ENV === "development" && (
  <button
    onClick={async () => {
      const res = await fetch("/api/test-bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, planId: "starter" }),
      });
      if (res.ok) {
        alert("Success! Table updated without paying. Refresh the page.");
        window.location.reload();
      } else {
        alert("Bypass failed. Check server terminal logs.");
      }
    }}
    className="mt-4 p-2 bg-red-600 text-white rounded text-xs font-bold"
  >
    ⚠️ Developer Test Bypass: Force Activate Starter Plan
  </button>
)}
    </div>
  );
}