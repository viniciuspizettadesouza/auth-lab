import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Avoid pre-hydration mutations of Next's hidden metadata wrapper by local
  // browser tooling. Production keeps the default streaming behavior.
  htmlLimitedBots: process.env.NODE_ENV === "development" ? /.*/ : undefined,
  experimental: {
    typedEnv: true
  }
};

export default nextConfig;
