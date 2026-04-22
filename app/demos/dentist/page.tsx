"use client";

import { useRouter } from "next/navigation";
import ChatWidget from "@/app/components/ChatWidget";

export default function DentistDemo() {
  const router = useRouter();

  return (
    <div className="bg-white text-gray-900 min-h-screen">

      {/* HERO */}
      <section className="bg-blue-600 text-white p-10 text-center">
        <h1 className="text-4xl font-bold mb-3">
          SmileCare Dental Clinic
        </h1>
        <p className="text-lg mb-5">
          Book appointments instantly with our AI assistant
        </p>

        <button
          onClick={() => router.push("/signup")}
          className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold"
        >
          Start Free Trial
        </button>
      </section>

      {/* SERVICES */}
      <section className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-6">Our Services</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-5 border rounded-xl">
            <h3 className="font-bold text-lg">Teeth Cleaning</h3>
            <p className="text-sm text-gray-600">
              Professional cleaning for a brighter smile
            </p>
          </div>

          <div className="p-5 border rounded-xl">
            <h3 className="font-bold text-lg">Dental Implants</h3>
            <p className="text-sm text-gray-600">
              Permanent solution for missing teeth
            </p>
          </div>

          <div className="p-5 border rounded-xl">
            <h3 className="font-bold text-lg">Braces</h3>
            <p className="text-sm text-gray-600">
              Straighten your teeth with modern braces
            </p>
          </div>
        </div>
      </section>

      {/* CHATBOT SECTION */}
      <section className="p-10 bg-gray-100 text-center">
        <h2 className="text-2xl font-bold mb-4">
          Book Appointment Instantly 🤖
        </h2>

        <p className="mb-6 text-gray-600">
          Try our AI assistant below — it can book appointments 24/7
        </p>

        <div className="max-w-xl mx-auto">
          <ChatWidget chatbotId="dentist-demo" isEmbed />
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="p-10 text-center">
        <h2 className="text-2xl font-bold mb-6">What Patients Say</h2>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-5 border rounded-xl">
            <p>"Super easy booking! No waiting calls."</p>
            <p className="mt-2 text-sm text-gray-500">– Rahul</p>
          </div>

          <div className="p-5 border rounded-xl">
            <p>"The chatbot booked my appointment in seconds."</p>
            <p className="mt-2 text-sm text-gray-500">– Sneha</p>
          </div>

          <div className="p-5 border rounded-xl">
            <p>"Very smooth and professional experience."</p>
            <p className="mt-2 text-sm text-gray-500">– Amit</p>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="p-10 bg-gray-900 text-white text-center">
        <h2 className="text-2xl font-bold mb-4">Visit Us</h2>
        <p>123 Smile Street, Mumbai</p>
        <p>📞 +91 98765 43210</p>
        <p className="mt-2 text-gray-400">
          Open Mon-Sat: 9AM - 7PM
        </p>
      </section>

    </div>
  );
}