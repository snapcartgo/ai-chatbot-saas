"use client";

import { useSearchParams } from "next/navigation";

export default function PaymentClient() {

  const params = useSearchParams();
  const plan = params.get("plan");

  const plans = {
    starter: { price: "₹999", messages: "500 AI messages", bots: "1 chatbot" },
    pro: { price: "₹1999", messages: "2000 AI messages", bots: "3 chatbots" },
    growth: { price: "₹4999", messages: "5000 AI messages", bots: "10 chatbots" }
  };

  const selectedPlan = plans[plan as "starter" | "pro" | "growth"];

  return (
    <div style={{padding:"40px"}}>

      <h1>Complete Your Payment</h1>

      <h2>{plan} Plan</h2>

      {selectedPlan && (
        <div>
          <p>{selectedPlan.price}</p>
          <p>{selectedPlan.messages}</p>
          <p>{selectedPlan.bots}</p>
        </div>
      )}

      <br />

      <button
        onClick={() => window.location.href="/api/paypal?plan="+plan}
      >
        Pay with PayPal
      </button>

      <br /><br />

      <button
        onClick={() => window.location.href="/api/payu?plan="+plan}
      >
        Pay with PayU
      </button>

    </div>
  );
}