"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";
import Header from "./Header";
import ChatWidget from "./ChatWidget";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isChatWidgetRoute = pathname.startsWith("/chat");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {!isChatWidgetRoute && <Header />}

      <main style={{ flex: 1 }}>{children}</main>

      {!isChatWidgetRoute && (
        <ChatWidget
          chatbotId="9ff1f58c-d09d-4449-97cc-a5860b640e2c"
          plan="free"
        />
      )}

      {!isChatWidgetRoute && <Footer />}
    </div>
  );
}
