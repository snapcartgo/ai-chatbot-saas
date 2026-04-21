/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // We REMOVED X-Frame-Options: DENY here.
          // In a multi-tenant SaaS, we let the Middleware 
          // set the dynamic 'frame-ancestors' policy instead.
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