"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "../components/LogoutButton";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Chatbots", href: "/dashboard/chatbots" },
    { name: "Conversations", href: "/dashboard/conversations" },
    { name: "Leads", href: "/dashboard/leads" },
    { name: "Pipeline", href: "/dashboard/pipeline" },
    { name: "Orders", href: "/dashboard/orders" },
    { name: "Knowledge Base", href: "/dashboard/knowledge-base" },
    { name: "Payment Settings", href: "/dashboard/settings/payments" },
    { name: "Billing", href: "/dashboard/Billing" },
  ];

  return (
    <div className="flex flex-col h-full justify-between">

      {/* 🔥 TOP MENU */}
      <div className="mt-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                block px-4 py-3 rounded-lg mx-2 text-sm md:text-base
                transition-all duration-200
                ${isActive 
                  ? "bg-blue-600 text-white" 
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"}
              `}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* 🔥 LOGOUT */}
      <div className="p-4 border-t border-gray-800">
        <LogoutButton />
      </div>
    </div>
  );
}