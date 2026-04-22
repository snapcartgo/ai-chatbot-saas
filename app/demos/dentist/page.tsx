"use client";

import { useRouter } from "next/navigation";

export default function DentistDemo() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-20 py-10">

      {/* HERO */}
      <h1 className="text-3xl md:text-5xl font-bold mb-4">
        Book Dental Appointments Automatically with AI
      </h1>

      <p className="text-gray-400 mb-6">
        Capture every patient and fill your calendar 24/7 without manual work.
      </p>

      <button
        onClick={() => router.push("/signup")}
        className="bg-blue-600 px-6 py-3 rounded-xl font-bold mb-10"
      >
        Start Free Trial
      </button>

      {/* VIDEO */}
      <div className="mb-10">
        <iframe
          width="100%"
          height="350"
          src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
          title="Demo"
          className="rounded-xl"
        />
      </div>

      {/* FEATURES */}
      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-4">What this chatbot does</h2>

        <ul className="text-gray-300 space-y-2">
          <li>✅ Books appointments instantly</li>
          <li>✅ Captures patient details automatically</li>
          <li>✅ Works 24/7 without staff</li>
        </ul>
      </div>

      {/* CHAT EXAMPLE */}
      <div className="bg-gray-900 p-5 rounded-xl mb-10">
        <p>User: I want appointment</p>
        <p>Bot: What treatment are you looking for?</p>
        <p>User: Teeth cleaning</p>
        <p>Bot: Available slots: Today 6 PM / Tomorrow 10 AM</p>
        <p>Bot: Please share your name & number</p>
      </div>

      {/* FINAL CTA */}
      <button
        onClick={() => router.push("/signup")}
        className="bg-green-600 px-6 py-3 rounded-xl font-bold"
      >
        Get This Chatbot for Your Clinic
      </button>

    </div>
  );
}