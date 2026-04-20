"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import ChatWidget from "./ChatWidget";

export default function ClientShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChatWidgetRoute = pathname.startsWith("/chat");

  return (
    <>
      {!isChatWidgetRoute && <Header />}
      <main style={{ flex: 1 }}>{children}</main>
      {!isChatWidgetRoute && (
        <ChatWidget
          chatbotId="9ff1f58c-d09d-4449-97cc-a5860b640e2c"
          plan="free"
        />
      )}
      {!isChatWidgetRoute && <Footer />}
    </>
  );
}
