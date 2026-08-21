"use client";

import { useState, useEffect } from "react";

export default function AIBotSettingsPage() {
  const [isByokUser, setIsByokUser] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [formData, setFormData] = useState({
    enableChatbot: true,
    useHistoryContext: true,
    botName: "Woodpetra AI",
    openaiApiKey: "",
    openaiOrgId: "",
    openaiModel: "gpt-4o-mini",
  });

  // Fetch settings & BYOK status on mount using the secure API route
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/ai-bot");
        const result = await res.json();

        if (res.ok && result.data && isMounted) {
          setIsByokUser(Boolean(result.data.is_byok));
          setFormData({
            botName: result.data.bot_name || "Woodpetra AI",
            openaiApiKey: result.data.openai_api_key || "",
            openaiOrgId: result.data.openai_org_id || "",
            openaiModel: result.data.openai_model || "gpt-4o-mini",
            enableChatbot: result.data.enable_chatbot ?? true,
            useHistoryContext: result.data.use_history_context ?? true,
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Block submission if BYOK active and key is missing
    if (isByokUser && !formData.openaiApiKey.trim()) {
      setValidationError(
        "OpenAI API Key is compulsory for your BYOK active subscription. Please enter your API key to continue."
      );
      return;
    }

    setLoading(true);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/settings/ai-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bot_name: formData.botName,
          openai_model: formData.openaiModel,
          enable_chatbot: formData.enableChatbot,
          use_history_context: formData.useHistoryContext,
          openai_api_key: formData.openaiApiKey,
          openai_org_id: formData.openaiOrgId,
        }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        alert("Error saving settings: " + (result.error || "Failed to save"));
      } else {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err: any) {
      alert("Unexpected error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen text-gray-800">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-600">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                OpenAI Chat Bot Setup
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Configure your custom AI bot integration and API credentials.
              </p>
            </div>
          </div>
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-full">
              ✓ Saved Successfully
            </span>
          )}
        </div>

        {/* BYOK Warning Banner */}
        {isByokUser && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-900 shadow-sm">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-bold">
                BYOK Plan Active (OpenAI Key Compulsory)
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                You are subscribed to a{" "}
                <strong>Bring Your Own Key (BYOK)</strong> plan for Website or
                WhatsApp. You must provide a valid OpenAI API key below for your
                bots to answer customer queries.
              </p>
            </div>
          </div>
        )}

        {/* Validation Error Alert */}
        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-medium p-4 rounded-xl">
            {validationError}
          </div>
        )}

        {/* Main Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6"
        >
          <p className="text-sm text-gray-600 leading-relaxed border-b border-gray-100 pb-4">
            Using OpenAI you can build your chatbot for your custom information
            so it can answer customer questions on WhatsApp and Web widgets
            automatically.
          </p>

          {/* Toggle 1: Enable Chat Bot */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Enable OpenAI Chat Bot
              </p>
              <p className="text-xs text-gray-500">
                Master switch to turn AI responses on or off.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enableChatbot}
                onChange={(e) =>
                  setFormData({ ...formData, enableChatbot: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Cost Warning Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
            <svg
              className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-xs leading-5">
              <strong>Note:</strong> Enabling this will send user message
              history to OpenAI to provide context. API usage charges will apply
              directly to your OpenAI account.
            </p>
          </div>

          {/* Toggle 2: Chat History Context */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Use existing chat history as context
              </p>
              <p className="text-xs text-gray-500">
                Allows AI to remember previous messages during conversation.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.useHistoryContext}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    useHistoryContext: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Field: Bot Name */}
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                Your API Name
              </label>
              <input
                type="text"
                value={formData.botName}
                onChange={(e) =>
                  setFormData({ ...formData, botName: e.target.value })
                }
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="e.g. Woodpetra AI"
              />
            </div>

            {/* Field: OpenAI Key with Show/Hide Eye Icon */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  OpenAI Key{" "}
                  {isByokUser && (
                    <span className="text-red-500">* (Compulsory)</span>
                  )}
                </label>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
                >
                  Get Key ↗
                </a>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder={
                    isByokUser
                      ? "sk-proj-... (Required for BYOK)"
                      : "sk-proj-..."
                  }
                  value={formData.openaiApiKey}
                  required={isByokUser}
                  onChange={(e) => {
                    setFormData({ ...formData, openaiApiKey: e.target.value });
                    if (validationError) setValidationError(null);
                  }}
                  className={`w-full bg-gray-50 border ${
                    isByokUser && !formData.openaiApiKey.trim()
                      ? "border-amber-400 focus:ring-amber-500"
                      : "border-gray-300 focus:ring-emerald-500"
                  } rounded-xl pl-4 pr-12 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:border-transparent outline-none transition-all`}
                />

                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
                  title={showApiKey ? "Hide API Key" : "Show API Key"}
                >
                  {showApiKey ? (
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Field: OpenAI Org ID */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  OpenAI Organization ID
                </label>
                <a
                  href="https://platform.openai.com/account/organization"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
                >
                  Get Org ID ↗
                </a>
              </div>
              <input
                type="text"
                placeholder="org-..."
                value={formData.openaiOrgId}
                onChange={(e) =>
                  setFormData({ ...formData, openaiOrgId: e.target.value })
                }
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            {/* Field: OpenAI Model */}
            <div className="col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  OpenAI Model
                </label>
                <a
                  href="https://platform.openai.com/docs/models"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
                >
                  View Models ↗
                </a>
              </div>
              <input
                type="text"
                value={formData.openaiModel}
                onChange={(e) =>
                  setFormData({ ...formData, openaiModel: e.target.value })
                }
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={loading || (isByokUser && !formData.openaiApiKey.trim())}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              {loading ? "Saving Settings..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}