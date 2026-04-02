"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ChatWidget from "./components/ChatWidget"; // 1. Import your widget

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Detects if the URL is the standalone chat page or embed route
  const isChatWidgetRoute = pathname.startsWith("/chat");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#000000",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Hide Header if it's the chatbot widget route */}
        {!isChatWidgetRoute && <Header />}

        <main style={{ flex: 1 }}>{children}</main>

        {/* 2. Render the ChatWidget globally.
          We hide it ONLY when the user is already on the /chat page 
          to prevent a "chatbot inside a chatbot" loop.
        */}
        {!isChatWidgetRoute && (
          <ChatWidget 
            chatbotId="9ff1f58c-d09d-4449-97cc-a5860b640e2c" 
            plan="free" 
          />
        )}

        {/* Hide Footer if it's the chatbot widget route */}
        {!isChatWidgetRoute && <Footer />}
      </body>
    </html>
  );
}