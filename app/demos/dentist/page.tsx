"use client";

import { useRouter } from "next/navigation";
import ChatWidget from "@/app/components/ChatWidget";

export default function DentistDemo() {
  const router = useRouter();

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen font-sans">
      
      {/* STICKY NAV BAR (Makes the demo feel like a real site) */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <span className="text-xl font-bold tracking-tight text-cyan-900">SmileCare AI</span>
        </div>
        <button 
          onClick={() => router.push("/signup")}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-full text-sm font-semibold transition-all"
        >
          Get This Bot
        </button>
      </nav>

      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-br from-cyan-900 to-blue-800 text-white py-20 px-10 text-center overflow-hidden">
        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="bg-cyan-400/20 text-cyan-300 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4 inline-block border border-cyan-400/30">
            24/7 Patient Concierge
          </span>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight">
            The Smartest Way to Manage Your Dental Practice
          </h1>
          <p className="text-lg text-white mt-3 max-w-2xl mx-auto">
            Stop losing patients to busy phone lines. Our AI handles bookings, emergency triage, and FAQ instantly.
          </p>

          <p className="text-md text-blue-100 mt-2 max-w-2xl mx-auto">
            Turn every patient inquiry into a confirmed appointment — capture symptoms, preferred time, and book visits automatically while tracking every conversation in your dashboard.
          </p>

          <button
            onClick={() => router.push("/signup")}
            className="mt-6 bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition"
          >
            Start Free Trial
          </button>
        </div>
      </section>

      {/* CHATBOT DEMO SECTION */}
      <section id="demo" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">
              Experience the Patient Journey
            </h2>
            <p className="text-slate-600 mb-8 text-lg">
              Interact with the bot on the right. Notice how it:
            </p>
            <ul className="space-y-4">
              {[
                "Identifies emergency vs. routine visits",
                "Captures patient contact details automatically",
                "Answers questions about insurance and pricing",
                "Syncs data directly to your dashboard"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <div className="flex-shrink-0 w-6 h-6 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center text-sm font-bold">✓</div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-100 p-4 rounded-3xl shadow-2xl border-8 border-slate-900/5 aspect-[4/5] lg:aspect-square overflow-hidden">
            {/* PRO TIP: Pass 'dentist' as a niche prop so your 
              ChatWidget knows which system prompt to use.
            */}
            <ChatWidget 
              chatbotId="086dbfda-26d0-40a6-a7db-604ca1228728" 
              niche="dentist" 
              isEmbed 
            />
          </div>
        </div>
      </section>

      {/* SERVICES GRID */}
      <section className="py-20 bg-slate-50 px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Patient Services</h2>
            <div className="h-1 w-20 bg-cyan-500 mx-auto mt-4"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Teeth Cleaning", desc: "Routine maintenance for optimal oral health." },
              { title: "Dental Implants", desc: "Advanced restorative surgery for missing teeth." },
              { title: "Orthodontics", desc: "Braces and Invisalign for the perfect alignment." }
            ].map((service, idx) => (
              <div key={idx} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-bold text-xl mb-3 text-cyan-900">{service.title}</h3>
                <p className="text-slate-600 leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-slate-900 text-slate-400 text-center border-t border-slate-800">
        <p className="mb-2">© 2026 Your Automation Agency</p>
        <p className="text-sm">Powering the next generation of local businesses.</p>
      </footer>
    </div>
  );
}