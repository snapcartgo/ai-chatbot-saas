"use client";

import { ReactNode } from "react";
import Link from "next/link";

export default function ChatbotsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 30,
        }}
      >
        <h1>Chatbots</h1>

        <Link
          href="/dashboard"
          style={{
            padding: "8px 14px",
            background: "#2563eb",
            color: "white",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Child Pages Render Here */}
      {children}
    </div>
  );
}