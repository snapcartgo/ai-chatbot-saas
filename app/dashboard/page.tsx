"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Sentry from "@sentry/nextjs";
import { WhatsAppSetupButton } from "../components/WhatsAppSetupButton";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [chatbotCategory, setChatbotCategory] = useState("booking");
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState("");

  useEffect(() => {
    async function initDashboard() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !user?.email) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email.toLowerCase());

      await Promise.all([
        supabase.from("profiles").upsert({
          id: user.id,
          email: user.email?.toLowerCase(),
        }),
        attachReferralFromStorage(user),
      ]);

      const [calRes, configsRes, botsRes] = await Promise.all([
        supabase
          .from("client_calendars")
          .select("calendar_id, client_name")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("whatsapp_configs")
          .select("phone_number")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("chatbots").select("id").eq("user_id", user.id),
      ]);

      if (calRes.data) {
        setCalendarId(calRes.data.calendar_id || "");
        setClientName(calRes.data.client_name || "");
      }

      if (configsRes.data) {
        setPhoneNumber(configsRes.data.phone_number || "");
      }

      const fetchedBotIds =
        botsRes.data?.map((b: { id: string }) => b.id) || [];

      const [leadsRes, bookingsRes] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("payment_status", "paid"),
      ]);

      const convosRes =
        fetchedBotIds.length > 0
          ? await supabase
              .from("messages")
              .select("*", { count: "exact", head: true })
              .in("bot_id", fetchedBotIds)
          : { count: 0 };

      setStats({
        leads: leadsRes.count || 0,
        conversations: convosRes.count || 0,
        bookings: bookingsRes.count || 0,
      });

      setLoading(false);
    }

    initDashboard();
  }, []);

  async function attachReferralFromStorage(user: {
    id?: string;
    email?: string | null;
  }) {
    try {
      const params = new URLSearchParams(window.location.search);
      const refFromUrl = params.get("ref");
      const refFromStorage = localStorage.getItem("referral");
      const ref = refFromUrl || refFromStorage;

      if (!ref || !user?.id || !user?.email) return;

      const res = await fetch("/api/referrals/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email.toLowerCase(),
          ref,
        }),
      });

      if (res.ok) localStorage.removeItem("referral");
    } catch (error) {
      Sentry.captureException(error);
    }
  }

  // Next.js function that opens Laravel and manually pre-fills the email field directly from the DOM
  const handleLaravelRedirectAndFill = (e: React.MouseEvent) => {
    e.preventDefault();

    const targetUrl = "https://marketing.woodpetra.in/auth/register/vendor";

    // 1. Open Laravel in a new window tab
    const newWindow = window.open(targetUrl, "_blank");

    if (newWindow && userEmail) {
      // 2. Wait briefly for the Laravel page elements to load completely
      const checkInterval = setInterval(() => {
        try {
          if (
            newWindow.document &&
            newWindow.document.readyState === "complete"
          ) {
            // 3. Find the email input element by its ID or name attributes
            const emailInput =
              (newWindow.document.getElementById("email") as HTMLInputElement) ||
              (newWindow.document.querySelector(
                'input[name="email"]'
              ) as HTMLInputElement);

            if (emailInput) {
              // 4. Inject the Next.js user email directly into the Laravel field
              emailInput.value = userEmail;

              // Trigger input events so any reactive frameworks or validations acknowledge the change
              emailInput.dispatchEvent(new Event("input", { bubbles: true }));

              clearInterval(checkInterval); // Done filling, clear the check
            }
          }
        } catch (error) {
          // If browser cross-origin flags block direct window script access, clear interval
          clearInterval(checkInterval);
        }
      }, 500); // Checks every half second
    }
  };

  async function handleCalendarSync(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const { error } = await supabase.from("client_calendars").upsert(
      {
        calendar_id: calendarId,
        client_name: clientName,
        user_id: userId,
        status: "pending",
      },
      { onConflict: "user_id" }
    );

    if (error) {
      alert(error.message);
    } else {
      alert("Success! Calendar synced.");
    }
  }

  async function saveManualPhoneNumber() {
    if (!userId) return;
    if (!phoneNumber.trim()) {
      alert("Please type a phone number first.");
      return;
    }

    setIsSavingPhone(true);

    const { error } = await supabase.from("whatsapp_configs").upsert(
      {
        user_id: userId,
        phone_number: phoneNumber.trim(),
        automation_enabled: true,
        workflow_type: "whatsapp_only",
        category: chatbotCategory,
        status: "active",
      } as any,
      { onConflict: "user_id" }
    );

    setIsSavingPhone(false);

    if (error) {
      alert("Database write error: " + error.message);
    } else {
      alert("WhatsApp configuration and category saved successfully!");
    }
  }

  const conversionRate =
    stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : "0.0";

  function getVideoUrl(video: string) {
    switch (video) {
      case "WEBSITE_INSTALL":
        return "https://youtu.be/PmV0MV4fEOM";

      case "WEBSITE_BOOKING":
        return "https://youtu.be/UYhfhYjapKA";

      case "WEBSITE_ECOMMERCE":
        return "https://youtu.be/I2O6OZDRCSA";

      case "WHATSAPP_INSTALL":
        return "https://www.youtube.com/embed/YOUR_VIDEO_ID_4";

      case "WHATSAPP_BOOKING":
        return "https://www.youtube.com/embed/YOUR_VIDEO_ID_5";

      case "WHATSAPP_ECOMMERCE":
        return "https://youtu.be/zf6vedneHX8";

      default:
        return "";
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Agency Dashboard
          </h1>

          <button
            onClick={() => setShowDemo(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-4 py-2 text-blue-600 font-semibold hover:bg-blue-50"
          >
            ▶ Watch Demo
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-lg animate-pulse">
            Updating stats...
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <StatCard
              title="Total Leads"
              value={stats.leads}
              color="bg-blue-600"
              href="/dashboard/leads"
            />
            <StatCard
              title="Conversations"
              value={stats.conversations}
              color="bg-purple-600"
              href="/dashboard/conversations"
            />
            <StatCard
              title="Orders"
              value={stats.bookings}
              color="bg-green-600"
              href="/dashboard/orders"
            />
            <StatCard
              title="Conversion Rate"
              value={`${conversionRate}%`}
              color="bg-orange-600"
              href="/dashboard/pipeline"
            />
          </div>
        )}

        <div className="mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-950 via-emerald-900 to-lime-900 shadow-2xl shadow-emerald-950/20">
          <div className="flex flex-col gap-6 px-6 py-7 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-200">
                WhatsApp Marketing
              </p>
              <h2 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">
                WhatsApp Bot
              </h2>
              <p className="mt-3 text-sm leading-6 text-emerald-100/85 md:text-base">
                Open your WhatsApp bot dashboard to manage campaigns, templates,
                bot replies, contacts, and automations from one place.
              </p>
            </div>

            {/* Replaced standard href with cross-window script injector */}
            <button
              onClick={handleLaravelRedirectAndFill}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-bold text-emerald-950 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-xl"
            >
              WhatsApp Bot
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">
              Calendar Integration Settings
            </h2>

            <form onSubmit={handleCalendarSync} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Client Name
                </label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client Name"
                  className="w-full border rounded-lg p-3 text-gray-900 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Calendar ID
                </label>
                <input
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="Calendar ID"
                  className="w-full border rounded-lg p-3 text-gray-900 bg-white"
                  required
                />
              </div>

              <button className="w-full bg-blue-600 text-white rounded-lg p-3 font-semibold hover:bg-blue-700 transition-colors">
                Save Configurations
              </button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
            <h2 className="text-xl font-bold mb-2 text-gray-800">
              WhatsApp Onboarding
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Connect your official Meta WhatsApp Business Account to enable
              automated AI messaging.
            </p>

            <div className="space-y-4 mt-auto">
              {/* 1. Phone Number Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Actual WhatsApp Phone Number
                </label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +14155238886"
                  className="w-full border rounded-lg p-3 text-sm text-gray-900 bg-white focus:outline-none"
                />
              </div>

              {/* 2. Chatbot Category Dropdown Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Chatbot Category
                </label>
                <select
                  value={chatbotCategory}
                  onChange={(e) => setChatbotCategory(e.target.value)}
                  className="w-full border rounded-lg p-3 text-sm text-gray-900 bg-white focus:outline-none appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundPosition: "right 12px center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "16px",
                  }}
                >
                  <option value="booking">Booking</option>
                  <option value="ecommerce">E-commerce</option>
                </select>
              </div>

              {/* 3. Combined Save Button */}
              <button
                onClick={saveManualPhoneNumber}
                disabled={isSavingPhone}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-3 text-sm transition-colors whitespace-nowrap mb-2"
              >
                {isSavingPhone
                  ? "Saving Settings..."
                  : "Save Configuration Settings"}
              </button>

              <div className="border-t border-gray-100 my-2 pt-2"></div>

              {/* 4. Connect WhatsApp Action */}
              {userId ? (
                <WhatsAppSetupButton clientId={userId} />
              ) : (
                <div className="h-12 w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400 text-sm">
                  Loading user session...
                </div>
              )}

              <p className="text-[10px] text-gray-400 mt-1 text-center">
                Requires Meta Business Verification for full message volume.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showDemo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Woodpetra Demo Center</h2>

              <button
                onClick={() => {
                  setShowDemo(false);
                  setSelectedVideo("");
                }}
                className="text-2xl"
              >
                ✕
              </button>
            </div>

            {!selectedVideo ? (
              <>
                <h3 className="text-lg font-semibold mb-3">
                  🌐 Website AI Chatbot
                </h3>

                <div className="space-y-3 mb-8">
                  <button
                    onClick={() => setSelectedVideo("WEBSITE_INSTALL")}
                    className="w-full text-left border rounded-lg p-4 hover:bg-gray-50"
                  >
                    ▶ Website Installation
                  </button>

                  <button
                    onClick={() => setSelectedVideo("WEBSITE_BOOKING")}
                    className="w-full text-left border rounded-lg p-4 hover:bg-gray-50"
                  >
                    ▶ Website Booking Chatbot
                  </button>

                  <button
                    onClick={() => setSelectedVideo("WEBSITE_ECOMMERCE")}
                    className="w-full text-left border rounded-lg p-4 hover:bg-gray-50"
                  >
                    ▶ Website E-commerce Chatbot
                  </button>
                </div>

                <h3 className="text-lg font-semibold mb-3">
                  📱 WhatsApp AI Chatbot
                </h3>

                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedVideo("WHATSAPP_INSTALL")}
                    className="w-full text-left border rounded-lg p-4 hover:bg-gray-50"
                  >
                    ▶ WhatsApp Installation
                  </button>

                  <button
                    onClick={() => setSelectedVideo("WHATSAPP_BOOKING")}
                    className="w-full text-left border rounded-lg p-4 hover:bg-gray-50"
                  >
                    ▶ WhatsApp Booking Chatbot
                  </button>

                  <button
                    onClick={() => setSelectedVideo("WHATSAPP_ECOMMERCE")}
                    className="w-full text-left border rounded-lg p-4 hover:bg-gray-50"
                  >
                    ▶ WhatsApp E-commerce Chatbot
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedVideo("")}
                  className="mb-4 text-blue-600"
                >
                  ← Back to Demo List
                </button>

                <iframe
                  width="100%"
                  height="550"
                  src={getVideoUrl(selectedVideo)}
                  allowFullScreen
                />
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  title,
  value,
  color,
  href,
}: {
  title: string;
  value: string | number;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block p-6 rounded-2xl text-white shadow-sm transition-transform hover:scale-[1.02] ${color}`}
    >
      <div className="text-xs font-bold uppercase opacity-70 tracking-wider">
        {title}
      </div>
      <div className="text-4xl font-extrabold mt-2 tracking-tight">
        {value}
      </div>
    </Link>
  );
}