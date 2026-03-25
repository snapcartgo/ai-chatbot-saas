import "./globals.css";
import type { Metadata, Viewport } from "next";
import Footer from "./components/Footer";
import Header from "./components/Header"; // 1. Import Header

export const metadata: Metadata = {
  title: "AI Chatbot SaaS",
  description: "AI chatbot platform for websites",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
          minHeight: "100vh", // Ensures footer stays at bottom if content is short
        }}
      >
        {/* 2. Header stays at the top */}
        <Header />

        {/* 3. Main content fills the space */}
        <main style={{ flex: 1 }}>{children}</main>

        {/* 4. Footer stays at the bottom */}
        <Footer />
      </body>
    </html>
  );
}