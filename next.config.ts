import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  
  async headers() {
    return [
      {
        source: "/chat/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *", // Allows embedding on any site
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL", // Forces Next.js to stop blocking the iframe
          },
        ],
      },
    ];
  },
};

export default nextConfig;