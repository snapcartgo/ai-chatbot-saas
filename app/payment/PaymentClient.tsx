"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
// If using Clerk, import useUser. If using Supabase Auth, import your hook.
// import { useUser } from "@clerk/nextjs"; 

export default function PaymentClient() {
  const params = useSearchParams();
  const plan = params.get("plan");
  
  // Replace this with your actual auth logic to get the logged-in email
  // Example for Clerk: const { user } = useUser();
  // const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  
  // For this example, let's assume you've stored it or can access it:
  const [userEmail, setUserEmail] = useState("amitmutrejaofficial@gmail.com");

  const plans = {
    starter: { price: "₹999", messages: "500 AI messages", bots: "1 chatbot" },
    pro: { price: "₹1999", messages: "2000 AI messages", bots: "3 chatbots" },
    growth: { price: "₹4999", messages: "5000 AI messages", bots: "10 chatbots" }
  };

  const selectedPlan = plans[plan as "starter" | "pro" | "growth"];

  const handlePayUPayment = () => {
    if (!plan) return alert("Please select a plan");
    if (!userEmail) return alert("User email not found. Please log in.");

    // We send both the plan and the email to your API
    // This allows your /api/payu route to set udf1 (email) and udf2 (plan)
    window.location.href = `/api/payu?plan=${plan}&email=${encodeURIComponent(userEmail)}`;
  };

  return (
    <div style={{ padding: "40px" }}>
      <h1>Complete Your Payment</h1>
      <h2>{plan} Plan</h2>

      {selectedPlan && (
        <div>
          <p><strong>Price:</strong> {selectedPlan.price}</p>
          <p><strong>Allowance:</strong> {selectedPlan.messages}</p>
          <p><strong>Capacity:</strong> {selectedPlan.bots}</p>
        </div>
      )}

      <p style={{ fontSize: "0.8rem", color: "#666" }}>
        Logged in as: {userEmail}
      </p>

      <br />

      <button
        onClick={() => window.location.href = "/api/paypal?plan=" + plan}
        style={{ padding: "10px 20px", cursor: "pointer" }}
      >
        Pay with PayPal
      </button>

      <br /><br />

      <button
        onClick={handlePayUPayment}
        style={{ 
          padding: "10px 20px", 
          cursor: "pointer", 
          backgroundColor: "#27ae60", 
          color: "white", 
          border: "none", 
          borderRadius: "4px" 
        }}
      >
        Pay with PayU
      </button>
    </div>
  );
}