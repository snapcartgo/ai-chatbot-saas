"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Uses your existing supabase.ts

export default function ChatWidget() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const sessionId = "session_test_new"; // Match your existing DB session

  

  // 1. REAL-TIME LISTENER: This watches Supabase for the AI's reply
  // 1. Change session_id to conversation_id here
useEffect(() => {
  const channel = supabase
    .channel('schema-db-changes')
    .on(
      'postgres_changes',
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        // 👇 UPDATE THIS LINE TO MATCH YOUR DB
        filter: `conversation_id=eq.${sessionId}` 
      },
      (payload) => {
        if (payload.new.role === 'assistant') {
          setMessages((prev) => [...prev, { role: 'assistant', content: payload.new.content }]);
          setIsLoading(false);
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);

 // Scroll down to find this part in your ChatWidget.tsx
const handleSendMessage = async () => {
  if (!userInput.trim()) return;

  const userMsg = { role: "user", content: userInput };
  setMessages(prev => [...prev, userMsg]);

  const currentInput = userInput;
  setUserInput("");
  setIsLoading(true);

  try {
    const response = await fetch(process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: currentInput,
        conversation_id: sessionId,
        bot_id: "f7b1a0c1-f55f-4bbc-8a27-d08b6076c3ea",
        user_id: "36f39a53-c183-43b3-9923-e7019d176f43"
      })
    });

    const data = await response.json();

    console.log("Webhook Response:", data); // VERY IMPORTANT DEBUG

    if (data.content) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.content }
      ]);
    }

  } catch (error) {
    console.error("Fetch error:", error);
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white border rounded-xl shadow-2xl flex flex-col overflow-hidden font-sans">
      <div className="bg-blue-600 p-4 text-white font-bold">Booking Assistant</div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] px-4 py-3 rounded-2xl shadow-sm ${
              msg.role === "user"
                ? "bg-blue-600 text-white rounded-tr-none"
                : "bg-slate-100 text-black rounded-tl-none border"
            }`}
          >
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {msg.content}
            </p>
          </div>
        </div>
      ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-500 p-3 rounded-2xl rounded-tl-none animate-pulse">
              AI is typing...
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-white flex gap-2">
  <input
    className="flex-1 border border-gray-300 rounded-lg px-3 py-2
               text-black placeholder-gray-500
               bg-white
               focus:outline-none focus:ring-2 focus:ring-blue-600"
    placeholder="Type your message..."
    value={userInput}
    onChange={(e) => setUserInput(e.target.value)}
    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
  />

  <button
    onClick={handleSendMessage}
    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
  >
    Send
  </button>
</div>
    </div>
  );
}