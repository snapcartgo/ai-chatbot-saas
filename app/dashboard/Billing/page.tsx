"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type GatewayType = "payu" | "paypal" | "razorpay";
type PlanCategory = "website" | "whatsapp" | "combo";

interface PlanItem {
  planId: string;
  name: string;
  usdPrice: number;
  usdBYOK: number;
  inrPrice: number;
  inrBYOK: number;
  description: string;
  messages: string;
  bots: string;
  knowledgeBase?: string;
  features: string[];
  highlight?: boolean;
}

const RAZORPAY_LINKS: {
  standard: Record<string, string>;
  byok: Record<string, string>;
} = {
  standard: {
    // Website
    starter: "https://rzp.io/rzp/WS1oIbCc",
    pro: "https://rzp.io/rzp/WS1oIbCc",
    growth: "https://rzp.io/rzp/WS1oIbCc",
    business: "https://rzp.io/rzp/WS1oIbCc",
    // WhatsApp
    whatsapp_starter: "https://rzp.io/rzp/vWl9upj",
    whatsapp_pro: "https://rzp.io/rzp/WS1oIbCc",
    whatsapp_growth: "https://rzp.io/rzp/WS1oIbCc",
    whatsapp_business: "https://rzp.io/rzp/WS1oIbCc",
    // Combo
    business_combo: "https://rzp.io/rzp/g8FCMwQH",
    enterprise_combo: "https://rzp.io/rzp/WS1oIbCc",
  },
  byok: {
    // Website (BYOK Links)
    starter: "https://rzp.io/rzp/f7BiwdB",
    pro: "https://rzp.io/rzp/f7BiwdB",
    growth: "https://rzp.io/rzp/f7BiwdB",
    business: "https://rzp.io/rzp/f7BiwdB",
    // WhatsApp (BYOK Links)
    whatsapp_starter: "https://rzp.io/rzp/J0zCJRsr",
    whatsapp_pro: "https://rzp.io/rzp/f7BiwdB",
    whatsapp_growth: "https://rzp.io/rzp/f7BiwdB",
    whatsapp_business: "https://rzp.io/rzp/f7BiwdB",
    // Combo (BYOK Links)
    business_combo: "https://rzp.io/rzp/YIK76lg1",
    enterprise_combo: "https://rzp.io/rzp/f7BiwdB",
  },
};

export default function BillingPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isIndia, setIsIndia] = useState(true);
  const [activeTab, setActiveTab] = useState<PlanCategory>("website");
  const [isBYOK, setIsBYOK] = useState(false);

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

      setIsIndia(data?.country === "India" || !data?.country);
    };

    getUserData();
  }, []);

  const handlePayment = async (
    planId: string,
    price: number,
    gateway: GatewayType
  ) => {
    let email = userEmail;

    if (!email) {
      const { data: { user } } = await supabase.auth.getUser();
      email = user?.email || null;
    }

    if (!email) {
      alert("User not logged in. Please log in to proceed.");
      return;
    }

    if (!isIndia && gateway === "payu") {
      alert("PayU is only available in India");
      return;
    }

    if (gateway === "razorpay") {
      const linkMap = isBYOK ? RAZORPAY_LINKS.byok : RAZORPAY_LINKS.standard;
      const razorpayUrl = linkMap[planId];

      if (!razorpayUrl) {
        alert(`Razorpay ${isBYOK ? "BYOK" : "standard"} link not configured for this plan`);
        return;
      }

      window.open(razorpayUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.location.href = `/api/${gateway}?plan=${encodeURIComponent(
      planId
    )}&category=${activeTab}&byok=${isBYOK}&email=${encodeURIComponent(
      email
    )}&amount=${price}`;
  };

  const PLANS_DATA: Record<PlanCategory, PlanItem[]> = {
    website: [
      {
        planId: "starter",
        name: "Starter",
        usdPrice: 19,
        usdBYOK: 12,
        inrPrice: 1499,
        inrBYOK: 999,
        description: "For small websites",
        messages: "1,000 AI Messages",
        bots: "1 AI Chatbot",
        knowledgeBase: "10 MB",
        features: [
          "Lead Capture",
          "Conversation History",
          "Basic Product Search",
          "3 Languages",
          "Basic Analytics",
          "Basic Automation",
        ],
      },
      {
        planId: "pro",
        name: "Pro",
        usdPrice: 39,
        usdBYOK: 25,
        inrPrice: 2999,
        inrBYOK: 1999,
        description: "For growing businesses",
        messages: "3,000 AI Messages",
        bots: "2 AI Chatbots",
        knowledgeBase: "30 MB",
        features: [
          "Lead Capture & History",
          "Booking & Human Handoff",
          "10 Languages",
          "Basic CRM / Pipeline",
          "Analytics & Automation",
        ],
        highlight: true,
      },
      {
        planId: "growth",
        name: "Growth",
        usdPrice: 69,
        usdBYOK: 45,
        inrPrice: 5499,
        inrBYOK: 3499,
        description: "For businesses needing automation + CRM",
        messages: "10,000 AI Messages",
        bots: "5 AI Chatbots",
        knowledgeBase: "100 MB",
        features: [
          "Booking & Human Handoff",
          "25+ Languages",
          "Advanced CRM & Pipeline",
          "Advanced Analytics",
          "Advanced Automation",
          "Priority Support",
        ],
      },
      {
        planId: "business",
        name: "Business",
        usdPrice: 99,
        usdBYOK: 65,
        inrPrice: 7999,
        inrBYOK: 4999,
        description: "For high-volume websites",
        messages: "20,000 AI Messages",
        bots: "10 AI Chatbots",
        knowledgeBase: "200 MB",
        features: [
          "Advanced Product Search",
          "Booking & Human Handoff",
          "25+ Languages",
          "Advanced CRM & Pipeline",
          "Advanced Automation",
          "Priority Support",
        ],
      },
    ],
    whatsapp: [
      {
        planId: "whatsapp_starter",
        name: "Starter",
        usdPrice: 29,
        usdBYOK: 19,
        inrPrice: 2299,
        inrBYOK: 1499,
        description: "Basic WhatsApp bot for small setups",
        messages: "1,000 AI Messages",
        bots: "1 WhatsApp Chatbot",
        features: [
          "Auto Lead Capture",
          "Auto Replies",
          "Conversation Tracking",
          "Basic Product/E-commerce",
          "3 Languages",
          "Basic Automation",
        ],
      },
      {
        planId: "whatsapp_pro",
        name: "Pro",
        usdPrice: 59,
        usdBYOK: 39,
        inrPrice: 4499,
        inrBYOK: 2999,
        description: "Scale WhatsApp operations",
        messages: "3,000 AI Messages",
        bots: "2 WhatsApp Chatbots",
        features: [
          "Order Tracking & Booking",
          "Human Handoff",
          "Basic Follow-ups",
          "10 Languages",
          "Basic CRM & Analytics",
        ],
        highlight: true,
      },
      {
        planId: "whatsapp_growth",
        name: "Growth",
        usdPrice: 99,
        usdBYOK: 69,
        inrPrice: 7999,
        inrBYOK: 5499,
        description: "Full WhatsApp engagement & CRM",
        messages: "10,000 AI Messages",
        bots: "5 WhatsApp Chatbots",
        features: [
          "Advanced E-commerce & Orders",
          "Booking & Human Handoff",
          "Advanced Follow-ups",
          "25+ Languages",
          "Advanced CRM & Automation",
          "Priority Support",
        ],
      },
      {
        planId: "whatsapp_business",
        name: "Business",
        usdPrice: 149,
        usdBYOK: 105,
        inrPrice: 11999,
        inrBYOK: 8499,
        description: "High-throughput WhatsApp engine",
        messages: "25,000 AI Messages",
        bots: "10 WhatsApp Chatbots",
        features: [
          "Advanced E-commerce & Orders",
          "Booking & Human Handoff",
          "Advanced Follow-ups & CRM",
          "25+ Languages",
          "Full Automation Nodes",
          "Dedicated Support",
        ],
      },
    ],
    combo: [
      {
        planId: "business_combo",
        name: "Business Combo",
        usdPrice: 129,
        usdBYOK: 89,
        inrPrice: 9999,
        inrBYOK: 6999,
        description: "Full Website + WhatsApp integration",
        messages: "20,000 AI Messages",
        bots: "5 Chatbots (Web + WA)",
        knowledgeBase: "100 MB",
        features: [
          "Website & WhatsApp Chatbot",
          "Lead Capture & Advanced CRM",
          "E-commerce & Order Tracking",
          "Booking & Human Handoff",
          "Advanced Follow-ups",
          "25+ Languages",
          "Custom API & Automation",
          "Priority Support",
        ],
      },
      {
        planId: "enterprise_combo",
        name: "Enterprise Combo",
        usdPrice: 249,
        usdBYOK: 169,
        inrPrice: 19999,
        inrBYOK: 13999,
        description: "Complete omni-channel infrastructure",
        messages: "50,000 AI Messages",
        bots: "7 Chatbots (Web + WA)",
        knowledgeBase: "100 MB",
        features: [
          "Website & WhatsApp Chatbot",
          "Lead Capture & Advanced CRM",
          "E-commerce & Order Tracking",
          "Booking & Human Handoff",
          "Advanced Follow-ups",
          "25+ Languages",
          "Custom API & Full Automation",
          "Dedicated Support",
        ],
        highlight: true,
      },
    ],
  };

  const currentPlans = PLANS_DATA[activeTab];

  return (
    <div className="min-h-screen w-full bg-black p-4 text-white md:p-8">
      <h1 className="mb-2 text-xl font-bold md:text-3xl">Billing Plans</h1>
      <p className="mb-6 text-sm text-gray-400 md:mb-8 md:text-base">
        Choose the plan that fits your business needs.
      </p>

      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => setActiveTab("website")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "website"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "border border-gray-800 bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          🌐 Website Chatbot
        </button>
        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "whatsapp"
              ? "bg-green-600 text-white shadow-lg shadow-green-500/20"
              : "border border-gray-800 bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          💬 WhatsApp Chatbot
        </button>
        <button
          onClick={() => setActiveTab("combo")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "combo"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
              : "border border-gray-800 bg-gray-900 text-gray-400 hover:bg-gray-800"
          }`}
        >
          🔥 Website + WhatsApp Combined
        </button>
      </div>

      {/* BYOK Toggle */}
      <div className="mb-8 flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4 sm:w-fit sm:gap-6">
        <div>
          <p className="text-sm font-bold text-white">Use Your Own AI API Key (BYOK)</p>
          <p className="text-xs text-gray-400">Save up to ~35% by using your OpenAI key</p>
        </div>
        <button
          onClick={() => setIsBYOK(!isBYOK)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isBYOK ? "bg-blue-600" : "bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isBYOK ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Plans Grid */}
      <div
        className={`mb-10 grid grid-cols-1 gap-4 md:gap-6 ${
          activeTab === "combo"
            ? "mx-auto max-w-4xl md:grid-cols-2"
            : "md:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        {currentPlans.map((plan) => {
          const finalPrice = isIndia
            ? isBYOK
              ? plan.inrBYOK
              : plan.inrPrice
            : isBYOK
            ? plan.usdBYOK
            : plan.usdPrice;

          const currencySymbol = isIndia ? "₹" : "$";

          return (
            <div
              key={plan.planId}
              className={`relative flex flex-col rounded-2xl border bg-gray-900 p-5 md:p-6 ${
                plan.highlight
                  ? activeTab === "whatsapp"
                    ? "border-green-500 shadow-lg shadow-green-500/20"
                    : activeTab === "combo"
                    ? "border-purple-500 shadow-lg shadow-purple-500/20"
                    : "border-blue-500 shadow-lg shadow-blue-500/20"
                  : "border-gray-800"
              }`}
            >
              {plan.highlight && (
                <span
                  className={`absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white ${
                    activeTab === "whatsapp"
                      ? "bg-green-600"
                      : activeTab === "combo"
                      ? "bg-purple-600"
                      : "bg-blue-600"
                  }`}
                >
                  Most Popular
                </span>
              )}

              <h2 className="mb-1 text-lg font-bold md:text-2xl">{plan.name}</h2>

              <p className="mb-1 text-2xl font-bold text-white md:text-3xl">
                {currencySymbol}
                {finalPrice}
                <span className="text-sm font-normal text-gray-400">/mo</span>
              </p>

              {isBYOK && (
                <span className="mb-3 inline-block w-fit rounded bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400">
                  BYOK Applied
                </span>
              )}

              <p className="mb-5 text-xs text-gray-400 md:text-sm">
                {plan.description}
              </p>

              <div className="mb-6 flex-grow space-y-2 text-xs text-gray-300 md:text-sm">
                <p className="font-semibold text-white">✅ {plan.messages}</p>
                <p>✅ {plan.bots}</p>
                {plan.knowledgeBase && <p>✅ Knowledge Base: {plan.knowledgeBase}</p>}

                {plan.features.map((feature, index) => (
                  <p key={index}>✅ {feature}</p>
                ))}
              </div>

              {/* Action Buttons */}
              <button
                onClick={() => handlePayment(plan.planId, finalPrice, "razorpay")}
                className="mb-2 w-full rounded-xl bg-green-600 py-2.5 font-bold hover:bg-green-700 md:py-3"
              >
                Pay with Razorpay
              </button>

              {isIndia && (
                <button
                  onClick={() => handlePayment(plan.planId, finalPrice, "payu")}
                  className={`mb-2 w-full rounded-xl py-2.5 font-bold transition-opacity hover:opacity-90 md:py-3 ${
                    activeTab === "whatsapp"
                      ? "bg-green-600"
                      : activeTab === "combo"
                      ? "bg-purple-600"
                      : "bg-blue-600"
                  }`}
                >
                  Pay with PayU
                </button>
              )}

              <button
                onClick={() => handlePayment(plan.planId, finalPrice, "paypal")}
                className="w-full rounded-xl border border-gray-700 py-2.5 font-bold transition-colors hover:bg-gray-800 md:py-3"
              >
                Pay with PayPal
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}