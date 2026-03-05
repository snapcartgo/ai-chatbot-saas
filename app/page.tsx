"use client";
import ChatWidget from './components/ChatWidget';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-4">Chatbot Test Page</h1>
      <p>Your "Pro" widget should appear in the bottom right corner.</p>
      
      {/* This line displays the widget you've been working on */}
      <ChatWidget />
    </main>
  );
}