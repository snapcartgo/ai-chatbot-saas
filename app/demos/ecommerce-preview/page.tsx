"use client";

import { useState } from "react";

export default function EcommerceDemo() {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi 👋 I’m your shopping assistant. I can help you find products, answer questions, and recommend the best options. What are you looking for today?",
    },
  ]);

  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input) return;

    const userMessage = { role: "user", text: input };

    // Fake AI response (replace with your backend later)
    let botReply = "Let me help you with that.";

    if (input.toLowerCase().includes("shoes")) {
      botReply =
        "👟 We have great running shoes starting from ₹1999. Would you like budget, premium, or sports category?";
    } else if (input.toLowerCase().includes("price")) {
      botReply =
        "💰 Prices vary from ₹999 to ₹4999 depending on quality and brand. Want me to suggest best value?";
    } else if (input.toLowerCase().includes("delivery")) {
      botReply =
        "🚚 Delivery usually takes 2–4 days. Express shipping is available in select cities.";
    }

    const botMessage = { role: "bot", text: botReply };

    setMessages([...messages, userMessage, botMessage]);
    setInput("");
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white p-6">
      {/* HEADER */}
      <div className="max-w-5xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-bold">
          AI E-commerce Assistant Demo
        </h1>
        <p className="text-gray-400 mt-2">
          Increase sales, automate support, and recommend products instantly.
        </p>
      </div>

      {/* FEATURES */}
      <div className="max-w-5xl mx-auto grid grid-cols-3 gap-4 mb-10">
        <div className="p-4 bg-[#0f172a] rounded-xl">
          🛍️ Product Recommendations
        </div>
        <div className="p-4 bg-[#0f172a] rounded-xl">
          💬 Instant Customer Support
        </div>
        <div className="p-4 bg-[#0f172a] rounded-xl">
          💰 Upsell & Cross-sell
        </div>
      </div>

      {/* CHAT UI */}
      <div className="max-w-3xl mx-auto bg-[#0f172a] rounded-xl p-4">
        <div className="h-[400px] overflow-y-auto mb-4 space-y-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg max-w-[75%] ${
                msg.role === "user"
                  ? "bg-blue-600 ml-auto"
                  : "bg-gray-700"
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>

        {/* INPUT */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about products, pricing, delivery..."
            className="flex-1 p-3 rounded bg-black border border-gray-700"
          />
          <button
            onClick={sendMessage}
            className="px-4 bg-blue-600 rounded-lg"
          >
            Send
          </button>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-10">
        <button className="px-6 py-3 bg-blue-600 rounded-xl">
          Get This AI for Your Store
        </button>
      </div>
    </div>
  );
}