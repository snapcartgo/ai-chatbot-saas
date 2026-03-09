"use client";

export default function BillingPage() {

  const handlePayU = (plan: string) => {
    window.location.href = `/api/payu?plan=${plan}`;
  };

  const handlePayPal = (plan: string) => {
    window.location.href = `/api/paypal?plan=${plan}`;
  };

  const plans = [
    {
      name: "Starter",
      description: "Basic chatbot plan",
      messages: "100 Messages",
      bots: "1 Chatbot",
      planId: "starter"
    },
    {
      name: "Pro",
      description: "Advanced chatbot plan",
      messages: "5000 Messages",
      bots: "5 Chatbots",
      planId: "pro"
    },
    {
      name: "Growth",
      description: "Best for businesses",
      messages: "20000 Messages",
      bots: "20 Chatbots",
      planId: "growth"
    }
  ];

  return (
    <div className="p-10">
      
      <h1 className="text-3xl font-bold mb-8">Billing Plans</h1>

      <div className="grid md:grid-cols-3 gap-8">

        {plans.map((plan) => (

          <div
            key={plan.name}
            className="border rounded-xl p-6 shadow-sm hover:shadow-lg transition bg-white"
          >

            <h2 className="text-xl font-semibold mb-2">
              {plan.name}
            </h2>

            <p className="text-gray-600 mb-4">
              {plan.description}
            </p>

            <div className="space-y-2 mb-6 text-sm text-gray-700">
              <p>{plan.messages}</p>
              <p>{plan.bots}</p>
            </div>

            <button
              onClick={() => handlePayU(plan.planId)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg mb-3 hover:bg-blue-700 transition"
            >
              Pay with PayU
            </button>

            <button
              onClick={() => handlePayPal(plan.planId)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg mb-3 hover:bg-blue-700 transition"
            >
              Pay with PayPal
            </button>

          </div>

        ))}

      </div>

    </div>
  );
}