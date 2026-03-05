"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ChatWidget() {

  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const sessionId = "session_test_new";

  // LOAD WELCOME MESSAGE FROM SUPABASE
  useEffect(() => {

    const loadBot = async () => {

      const { data } = await supabase
        .from("chatbots")
        .select("welcome_message")
        .eq("id", "f7b1a0c1-f55f-4bbc-8a27-d08b6076c3ea")
        .single();

      if (data?.welcome_message) {
        setMessages([
          {
            role: "assistant",
            content: data.welcome_message
          }
        ]);
      } else {
        setMessages([
          {
            role: "assistant",
            content: "Hello 👋 How can I help you today?"
          }
        ]);
      }

    };

    loadBot();

  }, []);


  // REALTIME LISTENER
  useEffect(() => {

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${sessionId}`
        },
        (payload) => {

          if (payload.new.role === "assistant") {

            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: payload.new.content }
            ]);

            setIsLoading(false);

          }

        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, []);


  const handleSendMessage = async () => {

    if (!userInput.trim()) return;

    const userMsg = { role: "user", content: userInput };

    setMessages((prev) => [...prev, userMsg]);

    const currentInput = userInput;

    setUserInput("");
    setIsLoading(true);

    try {

      const response = await fetch(
        process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL!,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: currentInput,
            conversation_id: sessionId,
            bot_id: "f7b1a0c1-f55f-4bbc-8a27-d08b6076c3ea",
            user_id: "36f39a53-c183-43b3-9923-e7019d176f43"
          })
        }
      );

      const data = await response.json();

      if (data.content) {

        setMessages((prev) => [
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

    <div className="fixed bottom-6 right-6 z-50 font-sans">

      {/* CHAT WINDOW */}

      {open && (

        <div className="w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3 border">

          {/* HEADER */}

          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">

            <div className="flex items-center gap-2">

              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold">
                AI
              </div>

              <div>

                <div className="font-semibold text-sm">
                  Booking Assistant
                </div>

                <div className="text-xs text-blue-200">
                  Online
                </div>

              </div>

            </div>

            <button
              onClick={() => setOpen(false)}
              className="text-white text-lg"
            >
              ✖
            </button>

          </div>


          {/* MESSAGES */}

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">

            {messages.map((msg, i) => (

              <div
                key={i}
                className={`flex ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-gray-100 text-black border rounded-tl-none"
                  }`}
                >

                  {msg.content}

                </div>

              </div>

            ))}

            {isLoading && (

              <div className="flex justify-start">

                <div className="bg-gray-200 text-gray-600 px-4 py-2 rounded-xl animate-pulse">
                  AI is typing...
                </div>

              </div>

            )}

          </div>


          {/* INPUT */}

          <div className="p-3 border-t bg-white flex gap-2">

            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-black text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask something..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleSendMessage()
              }
            />

            <button
              onClick={handleSendMessage}
              className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition"
            >
              Send
            </button>

          </div>

        </div>

      )}


      {/* FLOATING BUTTON */}

      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-xl flex items-center justify-center text-xl hover:bg-blue-700 transition"
      >
        💬
      </button>

    </div>

  );

}