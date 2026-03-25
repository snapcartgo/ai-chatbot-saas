"use client"; // This is required to use usePathname

import "./globals.css";
import { usePathname } from "next/navigation";
import Footer from "./components/Footer";
import Header from "./components/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // This detects if the URL is /chat/something
  const isChatWidget = pathname.startsWith("/chat");

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
        {/* Hide Header if it's the chatbot widget */}
        {!isChatWidget && <Header />}

        <main style={{ flex: 1 }}>{children}</main>

        {/* Hide Footer if it's the chatbot widget */}
        {!isChatWidget && <Footer />}
      </body>
    </html>
  );
}