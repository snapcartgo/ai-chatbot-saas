import "./globals.css";
import type { ReactNode } from "react";
import ClientShell from "./components/ClientShell";

export default function RootLayout({ children }: { children: ReactNode }) {
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
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
