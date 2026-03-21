// app/partners/page.tsx
import Link from 'next/link';

export default function PartnersInfoPage() {
  return (
    <div className="min-h-screen bg-black text-white py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-extrabold mb-6">
          Grow Your Agency with <span className="text-blue-500">AI Chatbots</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10">
          Partner with us and earn <span className="text-white font-bold">20% recurring commission</span> 
          for every client you bring to the platform.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mb-16 text-left">
          <div className="bg-[#111] p-6 rounded-2xl border border-gray-800">
            <h3 className="text-blue-500 font-bold mb-2">High Commission</h3>
            <p className="text-sm text-gray-400">Earn 20% every month for the lifetime of the customer's subscription.</p>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-gray-800">
            <h3 className="text-blue-500 font-bold mb-2">Easy Setup</h3>
            <p className="text-sm text-gray-400">Just share your unique link. We handle all the hosting and support.</p>
          </div>
          <div className="bg-[#111] p-6 rounded-2xl border border-gray-800">
            <h3 className="text-blue-500 font-bold mb-2">Agency Tools</h3>
            <p className="text-sm text-gray-400">Track all your clients and earnings in a dedicated dashboard.</p>
          </div>
        </div>

        {/* This button sends them to the dashboard where the "Login/Join" logic happens */}
        <Link href="/partner-dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-full font-bold text-lg transition-all">
          Become a Partner Now
        </Link>
      </div>
    </div>
  );
}