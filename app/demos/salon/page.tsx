"use client";

import { useRouter } from "next/navigation";
import ChatWidget from "@/app/components/ChatWidget";

export default function SalonDemo() {
  const router = useRouter();

  return (
    <div className="bg-white text-gray-900 min-h-screen">

      {/* HERO */}
      <section className="bg-pink-600 text-white p-12 text-center">
        <h1 className="text-4xl font-bold mb-3">
          GlowUp Salon
        </h1>
        <p className="text-lg mb-5">
          Book beauty services instantly with AI
        </p>

        <button
          onClick={() => router.push("/signup")}
          className="bg-white text-pink-600 px-6 py-3 rounded-xl font-bold"
        >
          Start Free Trial
        </button>
      </section>

      {/* SERVICES */}
      <section className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-6">Our Services</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-5 border rounded-xl">
            <h3 className="font-bold">Haircut</h3>
            <p className="text-gray-600">Modern styling</p>
          </div>

          <div className="p-5 border rounded-xl">
            <h3 className="font-bold">Facial</h3>
            <p className="text-gray-600">Glow treatment</p>
          </div>

          <div className="p-5 border rounded-xl">
            <h3 className="font-bold">Spa</h3>
            <p className="text-gray-600">Relax & refresh</p>
          </div>
        </div>
      </section>

      {/* CHATBOT */}
      <section className="p-10 bg-gray-100 text-center">
        <h2 className="text-2xl font-bold mb-3">
          Book Appointment Instantly 💇
        </h2>

        <p className="text-gray-600 mb-6">
          Chat with AI and book your slot in seconds
        </p>

        <div className="max-w-xl mx-auto">
          <ChatWidget chatbotId="043b55ad-b39a-43e9-9d63-9d560454998e" isEmbed />
        </div>
      </section>

      {/* BENEFITS */}
      <section className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-6">Why Clients Love Us</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div>✔ Instant booking</div>
          <div>✔ No waiting calls</div>
          <div>✔ 24/7 availability</div>
        </div>
      </section>

      {/* CTA */}
      <section className="p-10 text-center">
        <button
          onClick={() => router.push("/signup")}
          className="bg-pink-600 text-white px-6 py-3 rounded-xl font-bold"
        >
          Start Free Trial
        </button>
      </section>

    </div>
  );
}