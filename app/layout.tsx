import "./globals.css";
import type { Metadata, Viewport } from "next";
import Footer from "@/components/Footer"; // 1. Import your new Footer

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
          backgroundColor: "#000000", // Changed to Black for your Dark UI
          color: "#ffffff",
        }}
      >
        {/* The main content of your site */}
        <main>{children}</main>

        {/* 2. The Footer will now show on every page */}
        <Footer />
      </body>
    </html>
  );
}