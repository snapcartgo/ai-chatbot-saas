"use client";

import { useState } from "react";

export default function InstallWidget() {

  // temporary bot id (later fetch from Supabase)
  const botId = "abc123";

  const script = `<script src="https://yourdomain.com/chatbot.js" data-bot-id="${botId}"></script>`;

  const [copied, setCopied] = useState(false);

  const copyScript = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-8">

      {/* Page Title */}
      <h1 className="text-2xl font-bold mb-8">
        Install Your Chatbot
      </h1>

      {/* Step 1 */}
      <div className="mb-8">

        <h2 className="text-lg font-semibold mb-2">
          Step 1
        </h2>

        <p className="mb-4 text-gray-600">
          Copy the script below
        </p>

        {/* Script Box */}
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm break-all border border-gray-700">
          {script}
        </div>

        {/* Copy Button */}
        <button
          onClick={copyScript}
          className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          {copied ? "Copied ✓" : "Copy Script"}
        </button>

        {/* Copy Message */}
        {copied && (
          <p className="text-green-500 mt-2 text-sm">
            Script copied successfully!
          </p>
        )}

      </div>

      {/* Step 2 */}
      <div className="mb-6">

        <h2 className="text-lg font-semibold mb-2">
          Step 2
        </h2>

        <p className="text-gray-600">
          Paste this script before the {"</body>"} tag on your website.
        </p>

      </div>

      {/* Step 3 */}
      <div>

        <h2 className="text-lg font-semibold mb-2">
          Step 3
        </h2>

        <p className="text-gray-600">
          Publish your website and the chatbot will start working.
        </p>

      </div>

    </div>
  );
}