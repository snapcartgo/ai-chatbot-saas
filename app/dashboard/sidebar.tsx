"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "../components/LogoutButton";

export default function Sidebar() {
  const pathname = usePathname();
  const [showByokWarning, setShowByokWarning] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/settings/ai-bot");
        const result = await res.json();

        if (res.ok && result.data) {
          const isByok = Boolean(result.data.is_byok);
          const hasApiKey = Boolean(result.data.openai_api_key && result.data.openai_api_key.trim() !== "");

          // Show warning if user is on BYOK plan and has not added an API key
          setShowByokWarning(isByok && !hasApiKey);
        }
      } catch (err) {
        console.error("Sidebar BYOK status check error:", err);
      }
    }

    checkStatus();
  }, [pathname]);

  const menuItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Chatbots", href: "/dashboard/chatbots" },
    { name: "WhatsApp Inbox", href: "/dashboard/whatsapp-inbox" },
    { name: "Marketing Whatsapp", href: "/dashboard/marketing/templates" },
    { name: "Conversations", href: "/dashboard/conversations" },
    { name: "Leads", href: "/dashboard/leads" },
    { name: "Pipeline", href: "/dashboard/pipeline" },
    { name: "Orders", href: "/dashboard/orders" },
    { name: "Knowledge Base", href: "/dashboard/knowledge-base" },
    { name: "Products", href: "/dashboard/products" },
    { name: "Shipping Settings", href: "/dashboard/shipping-settings" },
    { name: "Payment Settings", href: "/dashboard/settings/payments" },
    { name: "Billing", href: "/dashboard/Billing" },
    { name: "AI Bot & Bot Settings", href: "/dashboard/settings/ai-bot" },
  ];

  return (
    <div className="flex flex-col h-full justify-between">
      <div className="mt-4 space-y-1">
        {menuItems.map((item) => {
          const isExternal = Boolean((item as any).external);
          const isActive = !isExternal && pathname === item.href;

          const className = `
            flex items-center justify-between px-4 py-3 rounded-lg mx-2 text-sm md:text-base
            transition-all duration-200
            ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }
          `;

          if (isExternal) {
            return (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                <span>{item.name}</span>
              </a>
            );
          }

          return (
            <Link key={item.name} href={item.href} className={className}>
              <span>{item.name}</span>

              {item.href === "/dashboard/settings/ai-bot" && showByokWarning && (
                <span
                  title="Action Required: BYOK active. API key is compulsory."
                  className="flex items-center justify-center text-red-400 bg-red-950/60 border border-red-500/50 px-1.5 py-0.5 rounded text-xs animate-pulse ml-2 font-bold"
                >
                  ⚠️
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-800">
        <LogoutButton />
      </div>
    </div>
  );
}