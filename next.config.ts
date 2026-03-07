import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This prevents Next.js from breaking the legacy pdf-parse library
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;