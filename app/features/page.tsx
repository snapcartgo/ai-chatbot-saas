export default function FeaturesPage() {
  const features = [
   {
  title: "AI Chatbot Automation",
  desc: "Automatically handle customer queries 24/7 without human effort."
},
    {
      title: "Lead Generation",
      desc: "Capture leads directly from your website visitors automatically.",
    },
    {
  title: "No-Code Setup",
  desc: "Set up your chatbot without any coding or technical skills."
},
    
{
  title: "Never Lose a Lead Again",
  desc: "Automatically follow up with every lead who didn’t buy and convert them into paying customers."
},
    {
      title: "Custom Knowledge Base",
      desc: "Train chatbot with your own data for accurate answers.",
    },
    {
      title: "Analytics Dashboard",
      desc: "Track conversations, leads, and performance easily.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-6 py-16">
      {/* Heading */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">Powerful Features</h1>
        <p className="text-gray-400">
          Everything you need to automate and grow your business
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-gray-900 p-6 rounded-2xl border border-gray-800 hover:border-blue-500 transition"
          >
            <h3 className="text-xl font-semibold mb-3">
              {feature.title}
            </h3>
            <p className="text-gray-400 text-sm">
              {feature.desc}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center mt-16">
        <a
          href="/dashboard"
          className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl text-white font-medium transition"
        >
          Get Started
        </a>
      </div>
    </div>
  );
}