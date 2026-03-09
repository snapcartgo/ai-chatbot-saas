import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is the specific line that stops the DOMMatrix crash
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;