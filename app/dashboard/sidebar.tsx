import LogoutButton from "../components/LogoutButton";

export default function Sidebar() {

  return (
    <div className="flex flex-col h-full justify-between">

      {/* Top Menu */}
      <div>

        <a href="/dashboard" className="block px-4 py-3">
          Dashboard
        </a>

        <a href="/dashboard/chatbots" className="block px-4 py-3">
          Chatbots
        </a>

        <a href="/dashboard/conversations" className="block px-4 py-3">
          Conversations
        </a>

        <a href="/dashboard/leads" className="block px-4 py-3">
          Leads
        </a>

        <a href="/dashboard/pipeline" className="block px-4 py-3">
          Pipeline
        </a>

        <a href="/dashboard/orders" className="block px-4 py-3">
          Orders
        </a>

        <a href="/dashboard/knowledge-base" className="block px-4 py-3">
          Knowledge Base
        </a>

         <a href="dashboard/settings/payments" className="block px-4 py-3">
          Payment Settings
        </a>

        <a href="/dashboard/Billing" className="block px-4 py-3">
          Billing
        </a>

      </div>

      {/* Bottom Logout */}
      <div className="p-4 border-t border-gray-800">
        <LogoutButton />
      </div>

    </div>
  );
}