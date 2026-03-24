import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import path from "node:path";

const workspaceRoot = path.resolve(process.cwd(), "..");

loadEnv({ path: path.join(workspaceRoot, ".env.local"), quiet: true });
loadEnv({ path: path.join(workspaceRoot, ".env"), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_PRIVY_APP_ID:
      process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID ?? "",
    NEXT_PUBLIC_PRIVY_CLIENT_ID:
      process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? "",
  },
  webpack: (config) => {
    config.resolve.alias["@farcaster/mini-app-solana"] = false;
    return config;
  },
};

export default nextConfig;
