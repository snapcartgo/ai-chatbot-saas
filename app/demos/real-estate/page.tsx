"use client";

import { useRouter } from "next/navigation";

export default function RealEstateDemo() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-10">

      {/* TITLE */}
      <h1 className="text-2xl md:text-4xl font-bold mb-3">
        Real Estate AI Chatbot Demo
      </h1>

      <p className="text-gray-400 mb-6">
        Capture buyer leads and schedule property visits automatically.
      </p>

      {/* VIDEO */}
      <div className="mb-8">
        <iframe
          width="100%"
          height="350"
          src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
          title="Real Estate Demo"
          allowFullScreen
          className="rounded-xl"
        />
      </div>

      {/* CTA */}
      <button
        onClick={() => router.push("/signup")}
        className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-700"
      >
        Start Free Trial for Real Estate
      </button>

      <p className="text-gray-500 mt-3 text-sm">
        No credit card required • Setup in 2 minutes
      </p>

    </div>
  );
}