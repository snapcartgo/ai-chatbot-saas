/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // We added "frame-ancestors" to authorize your specific website
            // Replace or add domains here if you have more than one client
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.supabase.in https:; frame-ancestors 'self' https://artistonboard.space https://www.artistonboard.space;",
          },
          {
            // CHANGED: We changed this from "DENY" to "SAMEORIGIN".
            // "DENY" prevents all framing. "SAMEORIGIN" allows framing on your own domain,
            // while the CSP above handles the external "artistonboard.space" domain.
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

// Injected content via Sentry wizard below
const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  org: "aiautomation-pj",
  project: "saas_chatbot",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  automaticVercelMonitors: true,
  treeshake: {
    removeDebugLogging: true,
  },
});