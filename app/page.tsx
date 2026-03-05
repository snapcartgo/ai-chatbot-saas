import ChatWidget from "./components/ChatWidget";
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-blue-500">AI Chatbot SaaS</h1>

        <div className="space-x-6">
          <a href="/login" className="text-gray-300 hover:text-white">Login</a>
          <a
            href="/signup"
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            Start Free
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="text-center py-24 px-6">
        <h2 className="text-5xl font-bold mb-6">
          Automate Customer Conversations with AI
        </h2>

        <p className="text-gray-400 max-w-xl mx-auto mb-10">
          Build AI chatbots that capture leads, answer questions, and
          automatically book appointments for your business.
        </p>

        <div className="space-x-4">
          <a
            href="/signup"
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
          >
            Start Free Trial
          </a>

          <a
            href="/dashboard"
            className="border border-gray-600 px-6 py-3 rounded-lg"
          >
            View Dashboard
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8 px-10 pb-24">

        <div className="bg-gray-900 p-6 rounded-xl">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            AI Chatbot
          </h3>
          <p className="text-gray-400">
            Automatically respond to customer queries using AI.
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            Lead Capture
          </h3>
          <p className="text-gray-400">
            Capture leads and customer details automatically.
          </p>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl">
          <h3 className="text-xl font-semibold mb-3 text-blue-400">
            Booking Automation
          </h3>
          <p className="text-gray-400">
            Let customers schedule appointments directly from the chatbot.
          </p>
        </div>

      </section>

      <ChatWidget />

    </main>
  );
}