"use client";

import "./globals.css";
import { usePathname } from "next/navigation";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ChatWidget from "./components/ChatWidget";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // 1. Logic to hide elements on specific routes
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
        {/* Only show Header if not in the standalone chat view */}
        {!isChatWidgetRoute && <Header />}

        <main style={{ flex: 1 }}>{children}</main>

        {/* 2. GLOBAL CHATBOT COMPONENT 
           This renders the chatbot on every page (Landing, Dashboard, etc.)
           We wrap it in a check so it doesn't load inside its own iframe.
        */}
        {!isChatWidgetRoute && (
          <ChatWidget 
            chatbotId="9ff1f58c-d09d-4449-97cc-a5860b640e2c" 
            plan="free" 
          />
        )}

        {!isChatWidgetRoute && <Footer />}
      </body>
    </html>
  );
}
