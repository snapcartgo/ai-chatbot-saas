"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Sentry from "@sentry/nextjs";
import { WhatsAppSetupButton } from "../components/WhatsAppSetupButton";

export default function DashboardPage() {
  const vendorConsoleUrl = "https://marketing.woodpetra.in/auth/register/vendor";

  const [stats, setStats] = useState({
    leads: 0,
    conversations: 0,
    bookings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [calendarId, setCalendarId] = useState("");
  const [clientName, setClientName] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

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
        status: "active",
      } as any,
      { onConflict: "user_id" }
    );

    setIsSavingPhone(false);

    if (error) {
      alert("Database write error: " + error.message);
    } else {
      alert("WhatsApp Phone Number saved into configuration table successfully!");
    }
  }

  const conversionRate =
    stats.leads > 0 ? ((stats.bookings / stats.leads) * 100).toFixed(1) : "0.0";

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Agency Dashboard
        </h1>

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

            <a
              href={vendorConsoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-7 py-4 text-sm font-bold text-emerald-950 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-xl"
            >
              WhatsApp Bot
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4">
              Account Integration Settings
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
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Actual WhatsApp Phone Number
                </label>

                <div className="flex gap-2">
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +14155238886"
                    className="flex-1 border rounded-lg p-3 text-sm text-gray-900 bg-white focus:outline-none"
                  />
                  <button
                    onClick={saveManualPhoneNumber}
                    disabled={isSavingPhone}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-4 text-xs transition-colors whitespace-nowrap"
                  >
                    {isSavingPhone ? "Saving..." : "Save Number"}
                  </button>
                </div>
              </div>

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