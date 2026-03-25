import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"], // Keep your existing line here
  
  async headers() {
    return [
      {
        // This targets your chat embed route
        source: "/chat/:path*", 
        headers: [
          {
            key: "Content-Security-Policy",
            // This allows your chatbot to be embedded on any website
            value: "frame-ancestors *", 
          },
        ],
      },
    ];
  },
};

export default nextConfig;