import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@mystery/shared"],
  output: "standalone",
  // Monorepo: trace dependencies from the repo root (hoisted node_modules).
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
};

export default nextConfig;
