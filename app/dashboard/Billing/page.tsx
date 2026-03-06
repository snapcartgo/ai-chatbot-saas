"use client";

export default function BillingPage() {

  // Temporary data (later fetch from Supabase)
  const plan = "Free";
  const messagesUsed = 12;
  const messageLimit = 50;

  return (
    <div className="max-w-3xl mx-auto p-8">

      <h1 className="text-2xl font-bold mb-6">
        Billing & Subscription
      </h1>

      {/* Current Plan */}
      <div className="bg-white border rounded-lg p-6 mb-6 shadow">

        <h2 className="text-lg font-semibold mb-2">
          Current Plan
        </h2>

        <p className="text-gray-600 mb-4">
          You are currently on the <b>{plan}</b> plan.
        </p>

        <div className="bg-gray-100 p-3 rounded">
          Messages Used: {messagesUsed} / {messageLimit}
        </div>

      </div>

      {/* Pricing Options */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Starter Plan */}
        <div className="border rounded-lg p-5 shadow">

          <h3 className="text-lg font-semibold mb-2">
            Starter
          </h3>

          <p className="text-2xl font-bold mb-2">
            ₹999 / month
          </p>

          <ul className="text-sm text-gray-600 mb-4">
            <li>• 500 AI messages</li>
            <li>• 1 chatbot</li>
            <li>• Lead capture</li>
          </ul>

          <button
            onClick={() => window.location.href = "/payment?plan=starter"}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
            Upgrade
            </button>

        </div>

        {/* Pro Plan */}
        <div className="border rounded-lg p-5 shadow">

          <h3 className="text-lg font-semibold mb-2">
            Pro
          </h3>

          <p className="text-2xl font-bold mb-2">
            ₹1999 / month
          </p>

          <ul className="text-sm text-gray-600 mb-4">
            <li>• 2000 AI messages</li>
            <li>• 1 chatbot</li>
            <li>• Advanced analytics</li>
          </ul>

          <button
            onClick={() => window.location.href = "/payment?plan=pro"}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
            Upgrade
            </button>
        </div>

        {/* Growth Plan */}
        <div className="border rounded-lg p-5 shadow">

          <h3 className="text-lg font-semibold mb-2">
            Growth
          </h3>

          <p className="text-2xl font-bold mb-2">
            ₹4999 / month
          </p>

          <ul className="text-sm text-gray-600 mb-4">
            <li>• 5000 AI messages</li>
            <li>• 3 chatbots</li>
            <li>• Priority support</li>
          </ul>

          <button
            onClick={() => window.location.href = "/payment?plan=growth"}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
            Upgrade
            </button>

        </div>

      </div>

    </div>
  );
}