"use client";

import { useRouter } from "next/navigation";
import ChatWidget from "@/app/components/ChatWidget";

export default function RealEstateDemo() {
  const router = useRouter();

  return (
    <div className="bg-white text-gray-900 min-h-screen">

      {/* HERO */}
      <section className="bg-green-600 text-white p-12 text-center">
        <h1 className="text-4xl font-bold mb-3">
          Prime Properties
        </h1>
        <p className="text-lg mb-5">
          Find your dream home instantly with AI
        </p>

        <button
          onClick={() => router.push("/signup")}
          className="bg-white text-green-600 px-6 py-3 rounded-xl font-bold"
        >
          Start Free Trial
        </button>
      </section>

      {/* LISTINGS */}
      <section className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-6">Featured Properties</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-5 border rounded-xl">
            <h3 className="font-bold">2BHK Apartment</h3>
            <p className="text-gray-600">Mumbai • ₹80L</p>
          </div>

          <div className="p-5 border rounded-xl">
            <h3 className="font-bold">Luxury Villa</h3>
            <p className="text-gray-600">Pune • ₹2.5Cr</p>
          </div>

          <div className="p-5 border rounded-xl">
            <h3 className="font-bold">Studio Flat</h3>
            <p className="text-gray-600">Bangalore • ₹45L</p>
          </div>
        </div>
      </section>

      {/* CHATBOT */}
      <section className="p-10 bg-gray-100 text-center">
        <h2 className="text-2xl font-bold mb-2">
          Find Properties Instantly 🏠
        </h2>

        <p className="text-gray-600 mb-3 max-w-xl mx-auto">
          Turn every property inquiry into a qualified buyer — capture budget, preferences, and schedule site visits automatically, while tracking every conversation in your dashboard.
        </p>

        <p className="text-gray-500 mb-6">
          Chat with AI to get matching properties & schedule visits
        </p>

        <div className="max-w-xl mx-auto">
          <ChatWidget chatbotId="e37f675f-f51c-45eb-8838-42a1a8864537" isEmbed />
        </div>
      </section>

      {/* TRUST */}
      <section className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-6">Why Choose Us</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>✔ Instant property matching</div>
          <div>✔ Schedule visits automatically</div>
          <div>✔ No manual follow-ups</div>
        </div>
      </section>

      {/* CTA */}
      <section className="p-10 text-center">
        <button
          onClick={() => router.push("/signup")}
          className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold"
        >
          Start Free Trial
        </button>
      </section>

    </div>
  );
}